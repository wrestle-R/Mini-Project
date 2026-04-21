import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import ProjectContractorAssignment from "@/lib/models/ProjectContractorAssignment";
import ProjectApplication from "@/lib/models/ProjectApplication";
import Worker from "@/lib/models/Worker";
import { normalizeProjectLocation } from "@/lib/project-location";
// Ensure schemas are registered
import "@/lib/models/Project";
import "@/lib/models/Contractor";
import "@/lib/models/Customer";
import "@/lib/models/Company";

/**
 * GET /api/contractor/assignments/[id]
 * Returns full detail for a single assignment including:
 * - project info, customer info
 * - all worker applications for that project
 * - worker profiles for applicants
 */
export async function GET(
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

    await dbConnect();

    const assignment = await ProjectContractorAssignment.findById(id)
      .populate("projectId")
      .populate("contractorId", "firstName lastName email")
      .populate("customerId", "name email phone");

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Verify this contractor owns the assignment
    if (assignment.contractorId?._id?.toString() !== payload.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = assignment.projectId as unknown as {
      _id: { toString(): string };
      companyId: unknown;
      title: string;
      description: string;
      status: string;
      location: unknown;
      startDate: Date | null;
      endDate: Date | null;
      budget: number;
      isOpen: boolean;
      createdAt: Date;
    };

    // Get all applications for this project
    const applications = await ProjectApplication.find({
      projectId: project._id,
    }).sort({ createdAt: -1 });

    // Fetch worker info
    const workerUids = [
      ...new Set(applications.map((a) => a.workerFirebaseUid)),
    ];
    const workers = await Worker.find({
      firebaseUid: { $in: workerUids },
    }).select("firebaseUid firstName lastName email photoUrl phone");

    const workerMap: Record<
      string,
      {
        firstName: string;
        lastName: string;
        email: string;
        photoUrl: string;
        phone: string;
      }
    > = {};
    for (const w of workers) {
      workerMap[w.firebaseUid] = {
        firstName: w.firstName,
        lastName: w.lastName,
        email: w.email,
        photoUrl: w.photoUrl,
        phone: w.phone,
      };
    }

    const customer = assignment.customerId as unknown as {
      name: string;
      email: string;
      phone: string;
    } | null;

    return NextResponse.json({
      assignment: {
        id: assignment._id.toString(),
        status: assignment.status,
        notes: assignment.notes,
        assignedAt: assignment.assignedAt,
      },
      project: {
        id: project._id.toString(),
        title: project.title,
        description: project.description,
        status: project.status,
        location: normalizeProjectLocation(project.location),
        startDate: project.startDate,
        endDate: project.endDate,
        budget: project.budget,
        isOpen: project.isOpen,
        createdAt: project.createdAt,
      },
      customer: customer
        ? { name: customer.name, email: customer.email, phone: customer.phone }
        : null,
      applications: applications.map((app) => ({
        id: app._id.toString(),
        workerFirebaseUid: app.workerFirebaseUid,
        worker: workerMap[app.workerFirebaseUid] || null,
        status: app.status,
        message: app.message,
        appliedAt: app.appliedAt,
        createdAt: app.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API/contractor/assignments/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
