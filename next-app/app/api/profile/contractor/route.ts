import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Contractor from "@/lib/models/Contractor";
import { verifyCustomToken } from "@/lib/auth";

export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "contractor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, phone } = body;

    await dbConnect();

    const updateFields: Record<string, string> = {};
    if (typeof firstName === "string") updateFields.firstName = firstName.trim();
    if (typeof lastName === "string") updateFields.lastName = lastName.trim();
    if (typeof phone === "string") updateFields.phone = phone.trim();

    const contractor = await Contractor.findByIdAndUpdate(
      payload.id,
      { $set: updateFields },
      { new: true }
    ).select("-password");

    if (!contractor) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: contractor._id.toString(),
      email: contractor.email,
      firstName: contractor.firstName,
      lastName: contractor.lastName,
      phone: contractor.phone,
      photoUrl: contractor.photoUrl || "",
      companyId: contractor.companyId.toString(),
    });
  } catch (error) {
    console.error("[API/profile/contractor] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
