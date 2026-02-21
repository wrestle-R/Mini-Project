import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ContractorProfile from "@/lib/models/ContractorProfile";
import { verifyCustomToken } from "@/lib/auth";
import "@/lib/models/Contractor"; // side-effect

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "contractor")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const profile = await ContractorProfile.findOne({ contractorId: payload.id }).lean();
    return NextResponse.json(profile || {});
  } catch (err) {
    console.error("[GET /api/profile/contractor/extended]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "contractor")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const allowed = [
      "bio", "industry", "companySize", "yearEstablished", "licenseNumber",
      "taxId", "socialLinks", "languages",
    ] as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    await dbConnect();
    const profile = await ContractorProfile.findOneAndUpdate(
      { contractorId: payload.id },
      { $set: update },
      { new: true, upsert: true, runValidators: false }
    ).lean();

    return NextResponse.json(profile);
  } catch (err) {
    console.error("[PUT /api/profile/contractor/extended]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
