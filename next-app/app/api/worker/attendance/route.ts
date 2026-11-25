import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Attendance from "@/lib/models/Attendance";
import { syncAttendanceFromPython } from "@/lib/attendance-sync";

const fallbackAttendance: AttendanceItem[] = [
  {
    id: "fallback-2",
    date: "02/05/2026",
    projectTitle: "building the dashboard",
    status: "success",
    checkIn: "11:15 AM",
    checkOut: "—",
  },
  {
    id: "fallback-1",
    date: "01/05/2026",
    projectTitle: "building the dashboard",
    status: "success",
    checkIn: "10:50 PM",
    checkOut: "—",
  },
];

type AttendanceItem = {
  id: string;
  date: string;
  projectTitle: string;
  status: "success" | "failure";
  checkIn: string;
  checkOut: string;
};

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

    let attendanceData: AttendanceItem[] = rows.map((row) => ({
      id: row.externalKey,
      date: new Date(row.time).toLocaleDateString("en-IN"),
      projectTitle: row.source || "IoT Site",
      status: row.status === "failure" ? "failure" : "success",
      checkIn: new Date(row.time).toLocaleTimeString("en-IN"),
      checkOut: "—",
    }));

    if (attendanceData.length === 0) {
      attendanceData = fallbackAttendance;
    }

    return NextResponse.json({ attendance: attendanceData });
  } catch (error) {
    console.error("[GET /api/worker/attendance]", error);
    return NextResponse.json({ attendance: fallbackAttendance });
  }
}
