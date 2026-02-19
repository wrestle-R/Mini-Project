import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Contractor from "@/lib/models/Contractor";
import bcrypt from "bcryptjs";
import { signCustomToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const contractor = await Contractor.findOne({
      email: email.toLowerCase().trim(),
    });
    if (!contractor) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, contractor.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = signCustomToken({
      id: contractor._id.toString(),
      email: contractor.email,
      role: "contractor",
    });

    return NextResponse.json({
      token,
      id: contractor._id.toString(),
      email: contractor.email,
      firstName: contractor.firstName,
      lastName: contractor.lastName,
      phone: contractor.phone,
      photoUrl: contractor.photoUrl || "",
      companyId: contractor.companyId.toString(),
      mustChangePassword: contractor.mustChangePassword,
    });
  } catch (error) {
    console.error("[API/auth/contractor/login] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
