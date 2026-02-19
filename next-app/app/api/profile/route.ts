import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Worker from "@/lib/models/Worker";

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

// Worker profile update (Firebase auth)
export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const firebaseUid = await getFirebaseUid(authHeader);

    if (!firebaseUid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, phone } = body;

    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      typeof phone !== "string"
    ) {
      return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
    }

    await dbConnect();

    const worker = await Worker.findOneAndUpdate(
      { firebaseUid },
      { $set: { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() } },
      { new: true }
    );

    if (worker) {
      return NextResponse.json({
        firebaseUid: worker.firebaseUid,
        mongoId: worker._id.toString(),
        firstName: worker.firstName,
        lastName: worker.lastName,
        email: worker.email,
        phone: worker.phone,
        photoUrl: worker.photoUrl || "",
        role: "worker",
      });
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch (err) {
    console.error("[API/profile] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
