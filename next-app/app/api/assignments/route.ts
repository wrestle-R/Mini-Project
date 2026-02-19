import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ProjectContractorAssignment from "@/lib/models/ProjectContractorAssignment";
import { verifyCustomToken } from "@/lib/auth";

// Assign a contractor to a project (company only)
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "company") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, contractorId, customerId, notes } = await req.json();

    if (!projectId || !contractorId) {
      return NextResponse.json(
        { error: "projectId and contractorId are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const assignment = await ProjectContractorAssignment.create({
      projectId,
      contractorId,
      customerId: customerId || null,
      companyId: payload.id,
      notes: notes?.trim() || "",
    });

    return NextResponse.json({
      id: assignment._id.toString(),
      projectId: assignment.projectId.toString(),
      contractorId: assignment.contractorId.toString(),
      customerId: assignment.customerId?.toString() || null,
      companyId: assignment.companyId.toString(),
      status: assignment.status,
      notes: assignment.notes,
      assignedAt: assignment.assignedAt,
    });
  } catch (error) {
    console.error("[API/assignments] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// List assignments (company sees all its assignments)
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    let filter: Record<string, string> = {};
    if (payload.role === "company") {
      filter = { companyId: payload.id };
    } else if (payload.role === "contractor") {
      filter = { contractorId: payload.id };
    }

    const assignments = await ProjectContractorAssignment.find(filter)
      .populate("projectId", "title status location")
      .populate("contractorId", "firstName lastName email")
      .populate("customerId", "name email phone")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        id: a._id.toString(),
        project: a.projectId,
        contractor: a.contractorId,
        customer: a.customerId,
        companyId: a.companyId.toString(),
        status: a.status,
        notes: a.notes,
        assignedAt: a.assignedAt,
      })),
    });
  } catch (error) {
    console.error("[API/assignments] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
