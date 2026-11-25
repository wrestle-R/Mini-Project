import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import ProjectContractorAssignment from "@/lib/models/ProjectContractorAssignment";
import ProjectApplication from "@/lib/models/ProjectApplication";
import Worker from "@/lib/models/Worker";
import { normalizeProjectLocation } from "@/lib/project-location";
// Ensure schemas are registered
import "@/lib/models/Project";

/**
 * GET /api/contractor/applications
 * Returns worker applications for all projects the contractor is assigned to.
 * Optional: ?projectId=xxx to filter by a specific project.
 */
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

    const url = new URL(req.url);
    const filterProjectId = url.searchParams.get("projectId");

    // Get all projects this contractor is assigned to
    const assignments = await ProjectContractorAssignment.find({
      contractorId: payload.id,
    }).populate("projectId", "title status location isOpen");

    const projectIds = assignments.map(
      (a) => (a.projectId as unknown as { _id: string })?._id ?? a.projectId
    );

    // Filter to a single project if requested
    const projectIdFilter = filterProjectId ? [filterProjectId] : projectIds;

    // Get all worker applications for those projects
    const applications = await ProjectApplication.find({
      projectId: { $in: projectIdFilter },
    }).sort({ createdAt: -1 });

    // Fetch worker info for each unique uid
    const workerUids = [
      ...new Set(applications.map((a) => a.workerFirebaseUid)),
    ];
    const workers = await Worker.find({
      firebaseUid: { $in: workerUids },
    }).select("firebaseUid firstName lastName email photoUrl");

    const workerMap: Record<
      string,
      { firstName: string; lastName: string; email: string; photoUrl: string }
    > = {};
    for (const w of workers) {
      workerMap[w.firebaseUid] = {
        firstName: w.firstName,
        lastName: w.lastName,
        email: w.email,
        photoUrl: w.photoUrl,
      };
    }

    // Build a helpful map: projectId -> project info
    const projectMap: Record<
      string,
      {
        title: string;
        status: string;
        location: ReturnType<typeof normalizeProjectLocation>;
      }
    > = {};
    for (const a of assignments) {
      const proj = a.projectId as unknown as {
        _id: { toString(): string };
        title: string;
        status: string;
        location: unknown;
      };
      if (proj && proj._id) {
        projectMap[proj._id.toString()] = {
          title: proj.title,
          status: proj.status,
          location: normalizeProjectLocation(proj.location),
        };
      }
    }

    return NextResponse.json({
      applications: applications.map((app) => ({
        id: app._id.toString(),
        projectId: app.projectId.toString(),
        project: projectMap[app.projectId.toString()] || null,
        workerFirebaseUid: app.workerFirebaseUid,
        worker: workerMap[app.workerFirebaseUid] || null,
        status: app.status,
        message: app.message,
        appliedAt: app.appliedAt,
        createdAt: app.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API/contractor/applications] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
