import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/lib/models/Project";
import ProjectApplication from "@/lib/models/ProjectApplication";
import { normalizeProjectLocation } from "@/lib/project-location";

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
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const fbUser = await verifyFirebaseToken(authHeader);
    if (!fbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const applications = await ProjectApplication.find({
      workerFirebaseUid: fbUser.uid,
    }).select("projectId status");

    const acceptedProjectIds = applications
      .filter((app) => app.status === "accepted")
      .map((app) => app.projectId);

    const [openOpportunities, pendingApplications, acceptedProjects, assignedProjects] =
      await Promise.all([
        Project.countDocuments({ isOpen: true }),
        ProjectApplication.countDocuments({
          workerFirebaseUid: fbUser.uid,
          status: "pending",
        }),
        ProjectApplication.countDocuments({
          workerFirebaseUid: fbUser.uid,
          status: "accepted",
        }),
        Project.find({ _id: { $in: acceptedProjectIds } }).select(
          "_id title status location"
        ),
      ]);

    const currentAssignments = assignedProjects.filter(
      (project) => project.status !== "completed" && project.status !== "cancelled"
    ).length;

    const mapProjects = assignedProjects.map((project) => ({
      id: project._id.toString(),
      title: project.title,
      status: project.status,
      location: normalizeProjectLocation(project.location),
      timeline:
        project.status === "completed" || project.status === "cancelled"
          ? "past"
          : "current",
    }));

    return NextResponse.json({
      stats: {
        openOpportunities,
        pendingApplications,
        acceptedProjects,
        currentAssignments,
      },
      mapProjects,
    });
  } catch (error) {
    console.error("[API/dashboard/worker/stats] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
