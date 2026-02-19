import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import dbConnect from "@/lib/db";
import Company from "@/lib/models/Company";
import Contractor from "@/lib/models/Contractor";
import Worker from "@/lib/models/Worker";
import { verifyCustomToken } from "@/lib/auth";

// Verify Firebase token (worker auth)
function verifyFirebaseToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
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
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const role = formData.get("role") as string | null;

    if (!file || !role) {
      return NextResponse.json(
        { error: "file and role are required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
        { status: 400 }
      );
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 5MB" },
        { status: 400 }
      );
    }

    // Auth based on role
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;

    if (role === "company" || role === "contractor") {
      if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
      if (!payload || payload.role !== role) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = payload.id;
    } else if (role === "worker") {
      const fbUser = verifyFirebaseToken(authHeader);
      if (!fbUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = fbUser.uid;
    } else {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Convert file to base64 data URI for cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    // Upload to Cloudinary
    const folder = `buildsync/${role}s`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: `${role}_${userId}`,
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    const imageUrl = result.secure_url;

    await dbConnect();

    // Save URL to the relevant model
    if (role === "company") {
      await Company.findByIdAndUpdate(userId, { $set: { logoUrl: imageUrl } });
    } else if (role === "contractor") {
      await Contractor.findByIdAndUpdate(userId, {
        $set: { photoUrl: imageUrl },
      });
    } else if (role === "worker") {
      await Worker.findOneAndUpdate(
        { firebaseUid: userId },
        { $set: { photoUrl: imageUrl } }
      );
    }

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("[API/upload] Error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
