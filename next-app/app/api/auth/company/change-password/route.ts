import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/lib/models/Company";
import bcrypt from "bcryptjs";
import { verifyCustomToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "company") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { newPassword } = await req.json();
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await dbConnect();

    const hashed = await bcrypt.hash(newPassword, 10);
    await Company.findByIdAndUpdate(payload.id, {
      password: hashed,
      mustChangePassword: false,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API/auth/company/change-password] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
