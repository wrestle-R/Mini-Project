import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/lib/models/Company";
import { verifyCustomToken } from "@/lib/auth";

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

    const company = await Company.findById(payload.id).select("-password");
    if (!company) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: company._id.toString(),
      email: company.email,
      name: company.name,
      sector: company.sector,
      phone: company.phone,
      logoUrl: company.logoUrl || "",
      mustChangePassword: company.mustChangePassword,
    });
  } catch (error) {
    console.error("[API/auth/company/me] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
