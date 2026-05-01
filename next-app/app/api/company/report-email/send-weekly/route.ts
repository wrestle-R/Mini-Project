import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import Company from "@/lib/models/Company";
import CompanyReportSettings from "@/lib/models/CompanyReportSettings";
import DailyReport from "@/lib/models/DailyReport";
import Project from "@/lib/models/Project";
import Worker from "@/lib/models/Worker";
import "@/lib/models/Contractor";
import { generateWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { sendWeeklyProjectReportMail } from "@/lib/report-mail";

function getCompanyId(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
  if (!payload || payload.role !== "company") return null;
  return payload.id;
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

async function serializeReportNames(reports: Array<Record<string, unknown>>) {
  const workerUids = [
    ...new Set(
      reports
        .map((report) => report.requesterWorkerFirebaseUid)
        .filter((uid): uid is string => typeof uid === "string" && uid.length > 0)
    ),
  ];
  const workers = await Worker.find({ firebaseUid: { $in: workerUids } }).select(
    "firebaseUid firstName lastName email"
  );
  const workerMap = new Map(
    workers.map((worker) => [
      worker.firebaseUid,
      [worker.firstName, worker.lastName].filter(Boolean).join(" ") ||
        worker.email ||
        "Worker",
    ])
  );

  return reports.map((report) => {
    const contractor = report.requesterContractorId as
      | { firstName?: string; lastName?: string; email?: string }
      | null
      | undefined;
    const contractorName = contractor
      ? [contractor.firstName, contractor.lastName].filter(Boolean).join(" ") ||
        contractor.email ||
        "Contractor"
      : "Contractor";
    return {
      requesterRole: String(report.requesterRole || ""),
      requesterName:
        report.requesterRole === "worker"
          ? workerMap.get(String(report.requesterWorkerFirebaseUid)) || "Worker"
          : contractorName,
      reportDate: report.reportDate as Date,
      workSummary: String(report.workSummary || ""),
      manpowerCount: Number(report.manpowerCount || 0),
      materialsUsed: String(report.materialsUsed || ""),
      blockers: String(report.blockers || ""),
      nextDayPlan: String(report.nextDayPlan || ""),
    };
  });
}

export async function POST(req: Request) {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const selectedProjectId = String(body?.projectId || "");
    if (selectedProjectId && !mongoose.Types.ObjectId.isValid(selectedProjectId)) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }

    await dbConnect();

    const [company, settings] = await Promise.all([
      Company.findById(companyId).select("name email").lean(),
      CompanyReportSettings.findOne({ companyId }).lean(),
    ]);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    const recipients = settings?.recipients || [];
    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "Add at least one report recipient before sending weekly PDFs" },
        { status: 400 }
      );
    }

    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const periodLabel = `${start.toLocaleDateString("en-IN")} - ${end.toLocaleDateString("en-IN")}`;

    const projectFilter: Record<string, unknown> = { companyId };
    if (selectedProjectId) {
      projectFilter._id = selectedProjectId;
    }
    const projects = await Project.find(projectFilter).select("title").lean();
    let sentCount = 0;

    for (const project of projects) {
      const reports = await DailyReport.find({
        companyId,
        projectId: project._id,
        reportDate: { $gte: start, $lte: end },
      })
        .populate("requesterContractorId", "firstName lastName email")
        .sort({ reportDate: 1, createdAt: 1 })
        .lean();

      const namedReports = await serializeReportNames(reports);
      const pdfBuffer = await generateWeeklyReportPdf({
        companyName: company.name || company.email || "Company",
        projectTitle: project.title || "Untitled project",
        periodLabel,
        reports: namedReports,
      });

      await sendWeeklyProjectReportMail({
        companyName: company.name || company.email || "Company",
        projectTitle: project.title || "Untitled project",
        recipients,
        pdfBuffer,
        fileName: `${sanitizeFileName(project.title || "project")}-weekly-report.pdf`,
        periodLabel,
      });
      sentCount += 1;
    }

    return NextResponse.json({ ok: true, sentCount, recipients });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send weekly report";
    console.error("[API/company/report-email/send-weekly] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
