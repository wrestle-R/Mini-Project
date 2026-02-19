import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/lib/models/Company";
import { verifyCustomToken } from "@/lib/auth";

export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "company") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, sector } = body;

    await dbConnect();

    const updateFields: Record<string, string> = {};
    if (typeof name === "string") updateFields.name = name.trim();
    if (typeof phone === "string") updateFields.phone = phone.trim();
    if (typeof sector === "string") updateFields.sector = sector.trim();

    const company = await Company.findByIdAndUpdate(
      payload.id,
      { $set: updateFields },
      { new: true }
    ).select("-password");

    if (!company) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: company._id.toString(),
      email: company.email,
      name: company.name,
      phone: company.phone,
      sector: company.sector,
      logoUrl: company.logoUrl || "",
    });
  } catch (error) {
    console.error("[API/profile/company] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
