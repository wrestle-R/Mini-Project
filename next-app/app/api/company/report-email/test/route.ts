import { NextResponse } from "next/server";
import { verifyCustomToken } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Company from "@/lib/models/Company";
import { sendReportTestMail } from "@/lib/report-mail";

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

    await dbConnect();

    const company = await Company.findById(payload.id).select("name email");
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const result = await sendReportTestMail(company.name || company.email);

    return NextResponse.json({
      ok: true,
      recipient: result.recipient,
      sentAt: result.sentAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send report test mail";
    console.error("[API/company/report-email/test] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
