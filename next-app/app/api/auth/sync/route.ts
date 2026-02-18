import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Worker from "@/lib/models/Worker";
import Contractor from "@/lib/models/Contractor";

// Simple Firebase token verification (decodes the JWT to get uid)
async function verifyFirebaseToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    // Decode the JWT payload (Firebase ID tokens are JWTs)
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    // Check expiration
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

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const firebaseUser = await verifyFirebaseToken(authHeader);

    if (!firebaseUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const role: "worker" | "contractor" = body.role || "worker";
    const firstName = body.firstName || firebaseUser.name?.split(" ")[0] || "";
    const lastName = body.lastName || firebaseUser.name?.split(" ").slice(1).join(" ") || "";
    const phoneNumber = body.phoneNumber || "";

    await dbConnect();

    // Check if user already exists in either collection
    const existingWorker = await Worker.findOne({ firebaseUid: firebaseUser.uid });
    if (existingWorker) {
      return NextResponse.json({
        firebaseUid: existingWorker.firebaseUid,
        mongoId: existingWorker._id.toString(),
        firstName: existingWorker.firstName,
        lastName: existingWorker.lastName,
        email: existingWorker.email,
        phone: existingWorker.phone,
        role: existingWorker.role,
      });
    }

    const existingContractor = await Contractor.findOne({ firebaseUid: firebaseUser.uid });
    if (existingContractor) {
      return NextResponse.json({
        firebaseUid: existingContractor.firebaseUid,
        mongoId: existingContractor._id.toString(),
        firstName: existingContractor.firstName,
        lastName: existingContractor.lastName,
        email: existingContractor.email,
        phone: existingContractor.phone,
        role: existingContractor.role,
      });
    }

    // User doesn't exist, create new
    const userData = {
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email || "",
      firstName,
      lastName,
      phone: phoneNumber,
    };

    if (role === "contractor") {
      const contractor = await Contractor.create({
        ...userData,
        companyName: "",
        role: "contractor",
      });
      console.log("[API/auth/sync] Created contractor:", contractor._id);
      return NextResponse.json({
        firebaseUid: contractor.firebaseUid,
        mongoId: contractor._id.toString(),
        firstName: contractor.firstName,
        lastName: contractor.lastName,
        email: contractor.email,
        phone: contractor.phone,
        role: contractor.role,
      });
    }

    // Default: create worker
    const worker = await Worker.create({
      ...userData,
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
