import { NextResponse } from "next/server";
import mongoose from "mongoose";
import JSZip from "jszip";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import GisValidationSnapshot from "@/lib/models/GisValidationSnapshot";
import ProjectReport from "@/lib/models/ProjectReport";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { downloadGridFSFileAsBuffer } from "@/lib/ifc/gridfs";
import { serializeIfcSession } from "@/lib/ifc/serializers";
import { getVersionCount } from "@/lib/ifc/sessions";
import { assertWorkflowTransition, type WorkflowState } from "@/lib/workflow/states";

function buildStakeholderSummary(params: {
  sessionTitle: string;
  reportVersion: number;
  fitResult: Record<string, unknown>;
  reportPayload: Record<string, unknown>;
  parcelSummary: { areaSqm?: number | null; centroid?: number[] } | null;
}) {
  const fitResult = params.fitResult || {};
  const reportPayload = params.reportPayload || {};
  const fitSummary = (reportPayload.fitSummary || {}) as Record<string, unknown>;
  const timeEstimate = (reportPayload.timeEstimate || {}) as Record<string, unknown>;
  const workforceEstimate = (reportPayload.workforceEstimate || {}) as Record<string, unknown>;
  const costEstimate = (reportPayload.costEstimate || {}) as Record<string, unknown>;
  const environmental = (fitSummary.environmentalSummary || fitResult.environmental_summary || {}) as Record<string, unknown>;
  const infrastructure = (fitSummary.infrastructureSummary || fitResult.infrastructure_summary || {}) as Record<string, unknown>;
  const centroid = params.parcelSummary?.centroid || [];

  return [
    `# GIS Stakeholder Brief`,
    ``,
    `Project: ${params.sessionTitle}`,
    `Report version: ${params.reportVersion}`,
    `Fit status: ${String(fitSummary.fitStatus || fitResult.fit_status || "unknown")}`,
    `Fit score: ${String(fitSummary.fitScore ?? fitResult.fit_score ?? "n/a")}`,
    `Parcel area (sqm): ${String(params.parcelSummary?.areaSqm ?? fitResult.land_area_sqm ?? "n/a")}`,
    `Parcel centroid: ${centroid.length === 2 ? `${centroid[1]}, ${centroid[0]}` : "n/a"}`,
    `Estimated duration (days): ${String(timeEstimate.estimatedDurationDays ?? "n/a")}`,
    `Recommended workers: ${String(workforceEstimate.totalRecommendedWorkers ?? "n/a")}`,
    `Estimated budget: ${String(costEstimate.totalBudget ?? "n/a")}`,
    `Environmental suitability: ${String(environmental.suitability_score ?? "n/a")}`,
    `Flood risk: ${String(environmental.flood_risk_level ?? "n/a")}`,
    `Infrastructure readiness: ${String(infrastructure.readiness_score ?? "n/a")}`,
    `Utility coverage: ${String(infrastructure.utility_coverage_level ?? "n/a")}`,
    ``,
    `Key messages:`,
    ...(((fitResult.messages as unknown[]) || []).slice(0, 6).map((message) => `- ${String(message)}`)),
  ].join("\n");
}

export async function GET(req: Request) {
  try {
    const contractorId = getContractorIdFromAuthHeader(
      req.headers.get("authorization")
    );
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    await dbConnect();

    const session = await IfcSession.findOne({
      _id: new mongoose.Types.ObjectId(sessionId),
      contractorId: new mongoose.Types.ObjectId(contractorId),
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const report = await ProjectReport.findOne({
      sessionId: session._id,
      status: "current",
    }).sort({ versionNumber: -1 });
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const validationSnapshot = await GisValidationSnapshot.findOne({
      _id: report.validationSnapshotId,
      contractorId: new mongoose.Types.ObjectId(contractorId),
      sessionId: session._id,
    });

    const format = url.searchParams.get("format");
    if (format === "bundle") {
      const zip = new JSZip();
      const payload = report.report as Record<string, unknown>;
      const snapshot = validationSnapshot
        ? {
            id: validationSnapshot._id.toString(),
            status: validationSnapshot.status,
            completedAt: validationSnapshot.completedAt,
            fitResult: validationSnapshot.fitResult,
            parcelSummary: validationSnapshot.parcelSummary,
            modelDimensions: validationSnapshot.modelDimensions,
          }
        : null;

      zip.file(
        "stakeholder-summary.md",
        buildStakeholderSummary({
          sessionTitle: session.title,
          reportVersion: report.versionNumber,
          fitResult: (snapshot?.fitResult || {}) as Record<string, unknown>,
          reportPayload: payload,
          parcelSummary: snapshot?.parcelSummary || null,
        })
      );
      zip.file(
        "report.json",
        JSON.stringify(
          {
            report: {
              id: report._id.toString(),
              versionNumber: report.versionNumber,
              status: report.status,
              generatedAt: report.generatedAt,
              payload,
            },
            session: serializeIfcSession(session, await getVersionCount(session._id.toString())),
            validationSnapshot: snapshot,
          },
          null,
          2
        )
      );
      if (validationSnapshot?.parcelGeojson) {
        zip.file("parcel.geojson", JSON.stringify(validationSnapshot.parcelGeojson, null, 2));
      }
      if (validationSnapshot?.fitResult) {
        zip.file("fit-validation.json", JSON.stringify(validationSnapshot.fitResult, null, 2));
      }

const buffer = await zip.generateAsync({ type: "nodebuffer" });
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="gis-report-bundle-${session._id.toString()}.zip"`,
        },
      });
    }

    return NextResponse.json({
      report: {
        id: report._id.toString(),
        versionNumber: report.versionNumber,
        status: report.status,
        generatedAt: report.generatedAt,
        payload: report.report,
      },
      session: serializeIfcSession(session, await getVersionCount(session._id.toString())),
      validationSnapshot: validationSnapshot
        ? {
            id: validationSnapshot._id.toString(),
            status: validationSnapshot.status,
            completedAt: validationSnapshot.completedAt,
            fitResult: validationSnapshot.fitResult,
            parcelSummary: validationSnapshot.parcelSummary,
            modelDimensions: validationSnapshot.modelDimensions,
          }
        : null,
    });
  } catch (error) {
    console.error("[API/contractor/workflow/reports][GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const contractorId = getContractorIdFromAuthHeader(
      req.headers.get("authorization")
    );
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const sessionId = body?.sessionId;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    await dbConnect();

    const session = await IfcSession.findOne({
      _id: new mongoose.Types.ObjectId(sessionId),
      contractorId: new mongoose.Types.ObjectId(contractorId),
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const currentState = (session.workflowState || "draft") as WorkflowState;
    if (currentState !== "land_validated" && currentState !== "report_generated") {
      return NextResponse.json(
        { error: `Cannot generate report from ${currentState}` },
        { status: 409 }
      );
    }
    if (currentState === "land_validated") {
      assertWorkflowTransition(currentState, "report_generated");
    }

    const validationSnapshotId =
      body?.validationSnapshotId || session.currentValidationSnapshotId?.toString();
    if (!mongoose.Types.ObjectId.isValid(validationSnapshotId)) {
      return NextResponse.json(
        { error: "A validation snapshot is required before report generation" },
        { status: 400 }
      );
    }

    const snapshot = await GisValidationSnapshot.findOne({
      _id: new mongoose.Types.ObjectId(validationSnapshotId),
      sessionId: session._id,
      contractorId: new mongoose.Types.ObjectId(contractorId),
      status: "current",
    });
    if (!snapshot) {
      return NextResponse.json(
        { error: "Validation snapshot was not found or is stale" },
        { status: 409 }
      );
    }

    if (snapshot.ifcVersionNumber !== session.currentVersionNumber) {
      snapshot.status = "stale";
      await snapshot.save();
      return NextResponse.json(
        {
          error: "Validation snapshot is stale because the IFC session version changed",
          currentVersionNumber: session.currentVersionNumber,
        },
        { status: 409 }
      );
    }

    const modelBuffer = await downloadGridFSFileAsBuffer(session.currentJsonFileId);
    const model = JSON.parse(modelBuffer.toString("utf-8"));
    const latestReport = await ProjectReport.findOne({ sessionId: session._id })
      .sort({ versionNumber: -1 })
      .select("versionNumber");
    const versionNumber = (latestReport?.versionNumber || 0) + 1;

    const backendUrl = (process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    const reportRes = await fetch(`${backendUrl}/api/workflow/report/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        validationSnapshotId: snapshot._id.toString(),
        ifcSessionId: session._id.toString(),
        ifcVersionNumber: session.currentVersionNumber,
        fitResult: snapshot.fitResult,
      }),
    });
    const reportJson = await reportRes.json().catch(() => null);
    if (!reportRes.ok) {
      throw new Error(reportJson?.detail || reportJson?.error || "Report generation failed");
    }
    const reportPayload = reportJson?.report;
    if (!reportPayload) {
      throw new Error("Report generation returned an empty payload");
    }

    await ProjectReport.updateMany(
      { sessionId: session._id, status: "current" },
      { $set: { status: "stale" } }
    );

    const report = await ProjectReport.create({
      contractorId: new mongoose.Types.ObjectId(contractorId),
      sessionId: session._id,
      validationSnapshotId: snapshot._id,
      ifcVersionId: session.currentVersionId || null,
      ifcVersionNumber: session.currentVersionNumber,
      versionNumber,
      status: "current",
      report: reportPayload,
      generatedAt: new Date(),
    });

    session.workflowState = "report_generated";
    session.currentReportId = report._id;
    await session.save();

    return NextResponse.json({
      report: {
        id: report._id.toString(),
        versionNumber: report.versionNumber,
        status: report.status,
        generatedAt: report.generatedAt,
        payload: report.report,
      },
      workflow: {
        state: session.workflowState,
        next: "company_approval",
      },
      session: serializeIfcSession(session, await getVersionCount(session._id.toString())),
    });
  } catch (error) {
    console.error("[API/contractor/workflow/reports][POST] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.startsWith("Invalid workflow transition") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
