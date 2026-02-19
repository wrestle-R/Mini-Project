import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Contractor from "@/lib/models/Contractor";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { verifyCustomToken } from "@/lib/auth";

// Company creates a contractor with auto-generated password
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

    const { email, firstName, lastName, phone } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const existing = await Contractor.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existing) {
      return NextResponse.json(
        { error: "Contractor with this email already exists" },
        { status: 409 }
      );
    }

    // Auto-generate a temporary password using nanoid
    const tempPassword = nanoid(12);
    const hashed = await bcrypt.hash(tempPassword, 10);

    const contractor = await Contractor.create({
      email: email.toLowerCase().trim(),
      password: hashed,
      firstName: firstName?.trim() || "",
      lastName: lastName?.trim() || "",
      phone: phone?.trim() || "",
      companyId: payload.id,
      mustChangePassword: true,
    });

    // Return the temp password so company can share it with the contractor
    return NextResponse.json({
      id: contractor._id.toString(),
      email: contractor.email,
      firstName: contractor.firstName,
      lastName: contractor.lastName,
      phone: contractor.phone,
      companyId: contractor.companyId.toString(),
      tempPassword, // company shares this with contractor
    });
  } catch (error) {
    console.error("[API/contractors] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// List contractors for this company
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "company") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const contractors = await Contractor.find({ companyId: payload.id })
      .select("-password")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      contractors: contractors.map((c) => ({
        id: c._id.toString(),
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        companyId: c.companyId.toString(),
        mustChangePassword: c.mustChangePassword,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API/contractors] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
