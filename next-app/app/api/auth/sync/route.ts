import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Worker from "@/lib/models/Worker";

// Simple Firebase token verification (decodes the JWT to get uid)
async function verifyFirebaseToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
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
      email: payload.email || "",
      name: payload.name || "",
    };
  } catch {
    return null;
  }
}

// Worker-only Firebase sync
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const firebaseUser = await verifyFirebaseToken(authHeader);

    if (!firebaseUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const firstName = body.firstName || firebaseUser.name?.split(" ")[0] || "";
    const lastName = body.lastName || firebaseUser.name?.split(" ").slice(1).join(" ") || "";
    const phoneNumber = body.phoneNumber || "";

    await dbConnect();

    // Upsert worker — always update names/phone so fresh signup data is never lost
    const existingWorker = await Worker.findOne({ firebaseUid: firebaseUser.uid });
    if (existingWorker) {
      // Update fields if we have new data
      if (firstName) existingWorker.firstName = firstName;
      if (lastName) existingWorker.lastName = lastName;
      if (phoneNumber) existingWorker.phone = phoneNumber;
      await existingWorker.save();
      return NextResponse.json({
        firebaseUid: existingWorker.firebaseUid,
        mongoId: existingWorker._id.toString(),
        firstName: existingWorker.firstName,
        lastName: existingWorker.lastName,
        email: existingWorker.email,
        phone: existingWorker.phone,
        photoUrl: existingWorker.photoUrl || "",
        role: existingWorker.role,
      });
    }

    // Create new worker
    const worker = await Worker.create({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email || "",
      firstName,
      lastName,
      phone: phoneNumber,
      role: "worker",
    });
    console.log("[API/auth/sync] Created worker:", worker._id);
    return NextResponse.json({
      firebaseUid: worker.firebaseUid,
      mongoId: worker._id.toString(),
      firstName: worker.firstName,
      lastName: worker.lastName,
      email: worker.email,
      phone: worker.phone,
      photoUrl: worker.photoUrl || "",
      role: worker.role,
    });
  } catch (error) {
    console.error("[API/auth/sync] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
