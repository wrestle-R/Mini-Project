import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import Project from "@/lib/models/Project";
import Contractor from "@/lib/models/Contractor";
import ProjectContractorAssignment from "@/lib/models/ProjectContractorAssignment";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "company") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const [projects, contractors, assignments] = await Promise.all([
      Project.countDocuments({ companyId: payload.id }),
      Contractor.countDocuments({ companyId: payload.id }),
      ProjectContractorAssignment.countDocuments({ companyId: payload.id }),
    ]);

    return NextResponse.json({
      stats: {
        projects,
        contractors,
        assignments,
      },
    });
  } catch (error) {
    console.error("[API/dashboard/company/stats] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
