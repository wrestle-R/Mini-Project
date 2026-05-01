import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import GisValidationSnapshot from "@/lib/models/GisValidationSnapshot";
import ProjectReport from "@/lib/models/ProjectReport";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { downloadGridFSFileAsBuffer } from "@/lib/ifc/gridfs";
import { serializeIfcSession } from "@/lib/ifc/serializers";
import { getVersionCount } from "@/lib/ifc/sessions";
import { assertWorkflowTransition, type WorkflowState } from "@/lib/workflow/states";
import { buildWorkflowReport } from "@/lib/workflow/report-service";

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

    const reportPayload = buildWorkflowReport({
      model,
      validationSnapshotId: snapshot._id.toString(),
      ifcSessionId: session._id.toString(),
      ifcVersionNumber: session.currentVersionNumber,
      fitResult: snapshot.fitResult,
    });

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
