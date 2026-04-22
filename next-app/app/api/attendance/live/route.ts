import { NextResponse } from "next/server";

import { syncAttendanceFromPython } from "@/lib/attendance-sync";
import { verifyCustomToken } from "@/lib/auth";

async function getFirebaseUid(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.user_id || payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const contractorOrCompany = authHeader?.startsWith("Bearer ")
      ? verifyCustomToken(authHeader.split("Bearer ")[1])
      : null;
    const workerUid = await getFirebaseUid(authHeader);

    const isAuthorized =
      Boolean(workerUid) ||
      Boolean(contractorOrCompany && ["company", "contractor"].includes(contractorOrCompany.role));

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalized = await syncAttendanceFromPython(40);
    const latest = normalized[normalized.length - 1] ?? null;

    return NextResponse.json({
      latest,
      records: normalized.slice(-20).reverse(),
    });
  } catch (error) {
    console.error("[GET /api/attendance/live]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
