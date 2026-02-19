import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Contractor from "@/lib/models/Contractor";
import { verifyCustomToken } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "contractor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const contractor = await Contractor.findById(payload.id).select(
      "-password"
    );
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
      mustChangePassword: contractor.mustChangePassword,
    });
  } catch (error) {
    console.error("[API/auth/contractor/me] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
