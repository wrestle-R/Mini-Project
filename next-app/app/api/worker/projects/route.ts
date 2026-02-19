import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/lib/models/Project";
import ProjectApplication from "@/lib/models/ProjectApplication";

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

// Worker lists open projects
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const fbUser = await verifyFirebaseToken(authHeader);
    if (!fbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const projects = await Project.find({ isOpen: true })
      .populate("companyId", "name sector")
      .sort({ createdAt: -1 });

    // Get worker's existing applications
    const applications = await ProjectApplication.find({
      workerFirebaseUid: fbUser.uid,
    });
    const appliedProjectIds = new Set(
      applications.map((a) => a.projectId.toString())
    );

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p._id.toString(),
        title: p.title,
        description: p.description,
        status: p.status,
        location: p.location,
        startDate: p.startDate,
        endDate: p.endDate,
        budget: p.budget,
        company: p.companyId,
        hasApplied: appliedProjectIds.has(p._id.toString()),
        createdAt: p.createdAt,
      })),
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
