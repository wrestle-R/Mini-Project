import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/lib/models/Company";
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

    const company = await Company.findOne({ email: email.toLowerCase().trim() });
    if (!company) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, company.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = signCustomToken({
      id: company._id.toString(),
      email: company.email,
      role: "company",
    });

    return NextResponse.json({
      token,
      id: company._id.toString(),
      email: company.email,
      name: company.name,
      sector: company.sector,
      phone: company.phone,
      logoUrl: company.logoUrl || "",
      mustChangePassword: company.mustChangePassword,
    });
  } catch (error) {
    console.error("[API/auth/company/login] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
