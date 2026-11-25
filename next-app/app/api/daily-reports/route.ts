import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import DailyReport from "@/lib/models/DailyReport";
import Project from "@/lib/models/Project";
import ProjectApplication from "@/lib/models/ProjectApplication";
import ProjectContractorAssignment from "@/lib/models/ProjectContractorAssignment";
import Worker from "@/lib/models/Worker";
import Company from "@/lib/models/Company";
import "@/lib/models/Contractor";
import {
  getActorReportProjects,
  nextReportDay,
  objectIdsFromProjects,
  startOfReportDay,
  type ReportActor,
} from "@/lib/daily-reports";

async function verifyFirebaseToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      uid: payload.user_id || payload.sub,
      email: payload.email || "",
    };
  } catch {
    return null;
  }
}

async function resolveActor(req: Request): Promise<ReportActor | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const bearer = authHeader.split("Bearer ")[1];
  const customPayload = verifyCustomToken(bearer);
  if (customPayload?.role === "company") {
    return { role: "company", id: customPayload.id };
  }
  if (customPayload?.role === "contractor") {
    return { role: "contractor", id: customPayload.id };
  }

  const firebaseUser = await verifyFirebaseToken(authHeader);
  if (!firebaseUser?.uid) return null;
  return { role: "worker", uid: firebaseUser.uid, email: firebaseUser.email };
}

async function serializeReports(reports: Array<Record<string, unknown>>) {
  const companyIds = [
    ...new Set(
      reports
        .filter((report) => report.requesterRole === "company")
        .map((report) => {
          const companyId = report.companyId as { toString(): string } | undefined;
          return companyId?.toString();
        })
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
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
  const companies = await Company.find({ _id: { $in: companyIds } }).select(
    "name email"
  );
  const companyMap = new Map(
    companies.map((company) => [
      company._id.toString(),
      company.name || company.email || "Company",
    ])
  );

  return reports.map((report) => {
    const project = report.projectId as
      | { _id?: { toString(): string }; title?: string; status?: string }
      | undefined;
    const contractor = report.requesterContractorId as
      | { firstName?: string; lastName?: string; email?: string }
      | null
      | undefined;
    const contractorName = contractor
      ? [contractor.firstName, contractor.lastName].filter(Boolean).join(" ") ||
        contractor.email ||
        "Contractor"
      : null;

    return {
      id: String(report._id),
      project: project?._id
        ? {
            id: project._id.toString(),
            title: project.title || "Untitled project",
            status: project.status || "planning",
          }
        : null,
      requesterRole: report.requesterRole,
      requesterName:
        report.requesterRole === "worker"
          ? workerMap.get(String(report.requesterWorkerFirebaseUid)) || "Worker"
          : report.requesterRole === "company"
            ? companyMap.get(String(report.companyId)) || "Company"
          : contractorName || "Contractor",
      reportDate: report.reportDate,
      workSummary: report.workSummary,
      manpowerCount: report.manpowerCount,
      materialsUsed: report.materialsUsed,
      blockers: report.blockers,
      nextDayPlan: report.nextDayPlan,
      attachments: report.attachments,
      notes: report.notes,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  });
}

function getDateFilter(url: URL) {
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const reportDate: Record<string, Date> = {};

  if (dateFrom) {
    const from = startOfReportDay(dateFrom);
    if (from) reportDate.$gte = from;
  }
  if (dateTo) {
    const to = startOfReportDay(dateTo);
    if (to) reportDate.$lt = nextReportDay(to);
  }

  return Object.keys(reportDate).length > 0 ? { reportDate } : {};
}

export async function GET(req: Request) {
  try {
    const actor = await resolveActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const url = new URL(req.url);
    const projects = await getActorReportProjects(actor);
    const projectIds = objectIdsFromProjects(projects);
    const filter: Record<string, unknown> = {
      projectId: { $in: projectIds },
      ...getDateFilter(url),
    };

    if (actor.role === "worker") {
      filter.requesterWorkerFirebaseUid = actor.uid;
    }
    if (actor.role === "contractor") {
      const role = url.searchParams.get("role");
      if (role === "worker" || role === "contractor") {
        filter.requesterRole = role;
      }
    }
    if (actor.role === "company") {
      filter.companyId = new mongoose.Types.ObjectId(actor.id);
      const role = url.searchParams.get("role");
      if (role === "worker" || role === "contractor" || role === "company") {
        filter.requesterRole = role;
      }
    }

    const projectId = url.searchParams.get("projectId");
    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      if (!projects.some((project) => project.id === projectId)) {
        return NextResponse.json({ projects, reports: [] });
      }
      filter.projectId = new mongoose.Types.ObjectId(projectId);
    }

    const reports = await DailyReport.find(filter)
      .populate("projectId", "title status")
      .populate("requesterContractorId", "firstName lastName email")
      .sort({ reportDate: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      projects,
      reports: await serializeReports(reports),
    });
  } catch (error) {
    console.error("[API/daily-reports][GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const projectId = String(body?.projectId || "");
    const reportDate = startOfReportDay(String(body?.reportDate || ""));
    const workSummary = String(body?.workSummary || "").trim();
    const manpowerCount = Number(body?.manpowerCount || 0);
    const materialsUsed = String(body?.materialsUsed || "").trim();
    const blockers = String(body?.blockers || "").trim();
    const nextDayPlan = String(body?.nextDayPlan || "").trim();
    const notes = String(body?.notes || "").trim();

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Project is required" }, { status: 400 });
    }
    if (!reportDate || !workSummary) {
      return NextResponse.json(
        { error: "Report date and work summary are required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(manpowerCount) || manpowerCount < 0) {
      return NextResponse.json({ error: "Manpower count is invalid" }, { status: 400 });
    }

    await dbConnect();

    const project = await Project.findById(projectId).select("companyId");
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (actor.role === "company" && project.companyId.toString() !== actor.id) {
      return NextResponse.json({ error: "Project access denied" }, { status: 403 });
    }

    if (actor.role === "worker") {
      const acceptedApplication = await ProjectApplication.findOne({
        projectId,
        workerFirebaseUid: actor.uid,
        status: "accepted",
      });
      if (!acceptedApplication) {
        return NextResponse.json({ error: "Project access denied" }, { status: 403 });
      }
    }

    let contractorId: mongoose.Types.ObjectId | null = null;
    if (actor.role === "contractor") {
      const assignment = await ProjectContractorAssignment.findOne({
        projectId,
        contractorId: actor.id,
        status: { $ne: "removed" },
      });
      if (!assignment) {
        return NextResponse.json({ error: "Project access denied" }, { status: 403 });
      }
      contractorId = new mongoose.Types.ObjectId(actor.id);
    }

    const actorKey =
      actor.role === "worker"
        ? actor.uid
        : actor.role === "contractor"
          ? contractorId?.toString() || actor.id
          : actor.id;
    const stableKey = [
      projectId,
      actor.role,
      actorKey,
      reportDate.toISOString().slice(0, 10),
    ].join(":");

    const report = await DailyReport.findOneAndUpdate(
      { stableKey },
      {
        $set: {
          companyId: project.companyId,
          projectId: new mongoose.Types.ObjectId(projectId),
          requesterRole: actor.role,
          requesterWorkerFirebaseUid: actor.role === "worker" ? actor.uid : null,
          requesterContractorId: contractorId,
          reportDate,
          workSummary,
          manpowerCount,
          materialsUsed,
          blockers,
          nextDayPlan,
          notes,
          attachments: Array.isArray(body?.attachments) ? body.attachments : [],
        },
        $setOnInsert: { stableKey },
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({ report: { id: report._id.toString() } });
  } catch (error) {
    console.error("[API/daily-reports][POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
