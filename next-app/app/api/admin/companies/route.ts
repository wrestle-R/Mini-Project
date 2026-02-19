import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/lib/models/Company";
import bcrypt from "bcryptjs";

// Hidden admin route protected by static secret
const ADMIN_SECRET = process.env.ADMIN_SECRET || "buildsync-admin-secret";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-admin-secret");
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email, password, name, sector } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const existing = await Company.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existing) {
      return NextResponse.json(
        { error: "Company with this email already exists" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    const company = await Company.create({
      email: email.toLowerCase().trim(),
      password: hashed,
      name: name.trim(),
      sector: sector?.trim() || "",
      mustChangePassword: true,
    });

    return NextResponse.json({
      id: company._id.toString(),
      email: company.email,
      name: company.name,
      sector: company.sector,
      mustChangePassword: company.mustChangePassword,
    });
  } catch (error) {
    console.error("[API/admin/create-company] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// List all companies (admin only)
export async function GET(req: Request) {
  try {
    const secret = req.headers.get("x-admin-secret");
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const companies = await Company.find()
      .select("-password")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      companies: companies.map((c) => ({
        id: c._id.toString(),
        email: c.email,
        name: c.name,
        sector: c.sector,
        phone: c.phone,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API/admin/companies] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
