import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CompanyProfile from "@/lib/models/CompanyProfile";
import { verifyCustomToken } from "@/lib/auth";
import "@/lib/models/Company"; // side-effect

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "company")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const profile = await CompanyProfile.findOne({ companyId: payload.id }).lean();
    return NextResponse.json(profile || {});
  } catch (err) {
    console.error("[GET /api/profile/company/extended]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "company")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const allowed = [
      "bio", "address", "website", "gstNumber", "panNumber",
      "yearEstablished", "employeeCount", "socialLinks",
      "languages", "serviceAreas", "specializations",
    ] as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    await dbConnect();
    const profile = await CompanyProfile.findOneAndUpdate(
      { companyId: payload.id },
      { $set: update },
      { new: true, upsert: true, runValidators: false }
    ).lean();

    return NextResponse.json(profile);
  } catch (err) {
    console.error("[PUT /api/profile/company/extended]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
