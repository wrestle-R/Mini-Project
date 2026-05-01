import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import CompanyReportSettings from "@/lib/models/CompanyReportSettings";

function getCompanyId(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
  if (!payload || payload.role !== "company") return null;
  return payload.id;
}

function normalizeRecipients(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((recipient) => String(recipient || "").trim().toLowerCase())
        .filter((recipient) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
    ),
  ];
}

export async function GET(req: Request) {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const settings = await CompanyReportSettings.findOne({ companyId }).lean();
    return NextResponse.json({ recipients: settings?.recipients || [] });
  } catch (error) {
    console.error("[API/company/report-email/settings][GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const recipients = normalizeRecipients(body?.recipients);
    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "At least one valid recipient email is required" },
        { status: 400 }
      );
    }

    await dbConnect();
    const settings = await CompanyReportSettings.findOneAndUpdate(
      { companyId },
      { $set: { recipients } },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({ recipients: settings?.recipients || recipients });
  } catch (error) {
    console.error("[API/company/report-email/settings][PUT] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
