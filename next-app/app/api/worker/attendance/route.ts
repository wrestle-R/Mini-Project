import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Attendance from "@/lib/models/Attendance";
import { syncAttendanceFromPython } from "@/lib/attendance-sync";

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

    await syncAttendanceFromPython(40);
    await dbConnect();

    const rows = await Attendance.find({
      recognizedId: fbUser.uid,
    })
      .sort({ time: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      attendance: rows.map((row) => ({
        id: row.externalKey,
        date: new Date(row.time).toLocaleDateString("en-IN"),
        projectTitle: row.source || "IoT Site",
        status: row.status,
        checkIn: new Date(row.time).toLocaleTimeString("en-IN"),
        checkOut: "—",
      })),
    });
  } catch (error) {
    console.error("[GET /api/worker/attendance]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
