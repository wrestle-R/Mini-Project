import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import ProjectContractorAssignment from "@/lib/models/ProjectContractorAssignment";
import ProjectApplication from "@/lib/models/ProjectApplication";

/**
 * PATCH /api/contractor/applications/[id]
 * Body: { status: "accepted" | "rejected" }
 * Only the contractor assigned to that project can update the status.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "contractor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body as { status: "accepted" | "rejected" };

    if (!status || !["accepted", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'accepted' or 'rejected'" },
        { status: 400 }
      );
    }

    await dbConnect();

    const application = await ProjectApplication.findById(id);
    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Verify the contractor is actually assigned to this project
    const assignment = await ProjectContractorAssignment.findOne({
      contractorId: payload.id,
      projectId: application.projectId,
    });
    if (!assignment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    application.status = status;
    await application.save();

    return NextResponse.json({
      id: application._id.toString(),
      projectId: application.projectId.toString(),
      workerFirebaseUid: application.workerFirebaseUid,
      status: application.status,
      message: application.message,
      appliedAt: application.appliedAt,
    });
  } catch (error) {
    console.error("[API/contractor/applications/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
