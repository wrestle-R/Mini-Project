import { NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import Attendance from "@/lib/models/Attendance";
import { syncAttendanceFromPython } from "@/lib/attendance-sync";

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

    await syncAttendanceFromPython(60);
    await dbConnect();

    const rows = await Attendance.find({}).sort({ time: -1 }).limit(40).lean();

    const total = rows.length;
    const success = rows.filter((r) => r.status === "success").length;
    const failure = rows.filter((r) => r.status === "failure").length;
    const ppeViolations = rows.filter((r) => r.ppe && !r.ppe.compliant).length;

    return NextResponse.json({
      stats: {
        total,
        success,
        failure,
        ppeViolations,
      },
      records: rows.map((r) => ({
        id: r.externalKey,
        name: r.recognizedName,
        recognizedId: r.recognizedId,
        status: r.status,
        reason: r.reason,
        source: r.source,
        score: r.score,
        time: r.time,
        ppe: r.ppe,
        frameUrl: r.frameUrl,
      })),
    });
  } catch (error) {
    console.error("[GET /api/dashboard/contractor/attendance]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
