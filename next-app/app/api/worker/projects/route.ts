import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/lib/models/Project";
import ProjectApplication from "@/lib/models/ProjectApplication";
// Import Company so Mongoose registers its schema before .populate("companyId") runs
import "@/lib/models/Company";

// Verify Firebase token (same pattern as worker auth)
async function verifyFirebaseToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      uid: payload.user_id || payload.sub,
      email: payload.email || "",
    };
  } catch {
    return null;
  }
}

// Worker lists open projects + their applications
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const fbUser = await verifyFirebaseToken(authHeader);
    if (!fbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Get ALL of this worker's applications (any status)
    const applications = await ProjectApplication.find({
      workerFirebaseUid: fbUser.uid,
    });
    const appMap = new Map<string, { status: string; appliedAt: Date; message: string }>();
    for (const a of applications) {
      appMap.set(a.projectId.toString(), {
        status: a.status,
        appliedAt: a.appliedAt,
        message: a.message,
      });
    }

    // Get open projects (available to browse)
    const openProjects = await Project.find({ isOpen: true })
      .populate("companyId", "name sector")
      .sort({ createdAt: -1 });

    // Get projects the worker has applied to (including closed ones)
    const appliedProjectIds = applications.map((a) => a.projectId);
    const appliedProjects = await Project.find({
      _id: { $in: appliedProjectIds },
    })
      .populate("companyId", "name sector")
      .sort({ createdAt: -1 });

    // Merge into a single deduplicated list
    const projectMap = new Map<string, typeof openProjects[0]>();
    for (const p of openProjects) projectMap.set(p._id.toString(), p);
    for (const p of appliedProjects) {
      if (!projectMap.has(p._id.toString())) projectMap.set(p._id.toString(), p);
    }

    const allProjects = Array.from(projectMap.values());

    return NextResponse.json({
      projects: allProjects.map((p) => {
        const app = appMap.get(p._id.toString());
        return {
          id: p._id.toString(),
          title: p.title,
          description: p.description,
          status: p.status,
          location: p.location,
          startDate: p.startDate,
          endDate: p.endDate,
          budget: p.budget,
          isOpen: p.isOpen,
          company: p.companyId,
          applicationStatus: app?.status || null, // "pending" | "accepted" | "rejected" | null
          appliedAt: app?.appliedAt || null,
          createdAt: p.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("[API/worker/projects] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Worker applies to a project
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const fbUser = await verifyFirebaseToken(authHeader);
    if (!fbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, message } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if already applied
    const existing = await ProjectApplication.findOne({
      projectId,
      workerFirebaseUid: fbUser.uid,
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already applied to this project" },
        { status: 409 }
      );
    }

    const application = await ProjectApplication.create({
      projectId,
      workerFirebaseUid: fbUser.uid,
      message: message?.trim() || "",
    });

    return NextResponse.json({
      id: application._id.toString(),
      projectId: application.projectId.toString(),
      status: application.status,
      message: application.message,
      appliedAt: application.appliedAt,
    });
  } catch (error) {
    console.error("[API/worker/projects] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
