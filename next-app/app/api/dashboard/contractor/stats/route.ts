import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import ProjectContractorAssignment from "@/lib/models/ProjectContractorAssignment";
import ProjectApplication from "@/lib/models/ProjectApplication";
import Project from "@/lib/models/Project";
import { normalizeProjectLocation } from "@/lib/project-location";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "contractor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const assignments = await ProjectContractorAssignment.find({
      contractorId: payload.id,
    }).select("projectId status");

    const assignmentProjectIds = assignments.map((a) => a.projectId);

    const [pendingApplications, acceptedApplications, activeAssignments, projects] =
      await Promise.all([
        ProjectApplication.countDocuments({
          projectId: { $in: assignmentProjectIds },
          status: "pending",
        }),
        ProjectApplication.countDocuments({
          projectId: { $in: assignmentProjectIds },
          status: "accepted",
        }),
        ProjectContractorAssignment.countDocuments({
          contractorId: payload.id,
          status: { $in: ["assigned", "in-progress"] },
        }),
        Project.find({ _id: { $in: assignmentProjectIds } }).select(
          "_id title status location"
        ),
      ]);

    const pastProjects = projects.filter(
      (project) => project.status === "completed" || project.status === "cancelled"
    ).length;

    const mapProjects = projects.map((project) => ({
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
        activeAssignments,
        pendingApplications,
        acceptedWorkers: acceptedApplications,
        pastProjects,
      },
      mapProjects,
    });
  } catch (error) {
    console.error("[API/dashboard/contractor/stats] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
