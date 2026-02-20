import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import WorkerProfile from "@/lib/models/WorkerProfile";
import "@/lib/models/Worker"; // side-effect: register Worker model

async function getFirebaseUid(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.user_id || payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const firebaseUid = await getFirebaseUid(req.headers.get("authorization"));
    if (!firebaseUid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const profile = await WorkerProfile.findOne({ firebaseUid }).lean();
    return NextResponse.json(profile || {});
  } catch (err) {
    console.error("[GET /api/profile/extended]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const firebaseUid = await getFirebaseUid(req.headers.get("authorization"));
    if (!firebaseUid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Whitelist updatable fields
    const allowed = [
      "bio", "skills", "tradeSpecialties", "experienceYears", "hourlyRate",
      "availability", "location", "languages", "certifications",
      "preferredWorkTypes", "toolsOwned", "hasVehicle", "willingToRelocate",
      "emergencyContact",
    ] as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    await dbConnect();
    const profile = await WorkerProfile.findOneAndUpdate(
      { firebaseUid },
      { $set: update },
      { new: true, upsert: true, runValidators: false }
    ).lean();

    return NextResponse.json(profile);
  } catch (err) {
    console.error("[PUT /api/profile/extended]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
