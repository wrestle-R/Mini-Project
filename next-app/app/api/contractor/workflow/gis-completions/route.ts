import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import GisValidationSnapshot from "@/lib/models/GisValidationSnapshot";
import ProjectReport from "@/lib/models/ProjectReport";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { assertWorkflowPath, type WorkflowState } from "@/lib/workflow/states";
import { serializeIfcSession } from "@/lib/ifc/serializers";
import { getVersionCount } from "@/lib/ifc/sessions";

function workflowPathForCompletion(current: WorkflowState) {
  if (current === "draft") return ["design_locked", "land_validated"] as WorkflowState[];
  if (current === "design_locked") return ["land_validated"] as WorkflowState[];
  if (current === "land_validated") return [] as WorkflowState[];
  return null;
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

    const fitResult = body?.fitResult;
    if (!fitResult || fitResult.fit_status !== "valid") {
      return NextResponse.json(
        { error: "Only valid fit results can be completed" },
        { status: 422 }
      );
    }

    if (!body?.parcelGeojson || !body?.modelDimensions) {
      return NextResponse.json(
        { error: "parcelGeojson and modelDimensions are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const session = await IfcSession.findOne({
      _id: new mongoose.Types.ObjectId(sessionId),
      contractorId: new mongoose.Types.ObjectId(contractorId),
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const clientVersionNumber = Number(body.ifcVersionNumber ?? session.currentVersionNumber);
    if (clientVersionNumber !== session.currentVersionNumber) {
      return NextResponse.json(
        {
          error: "Validation is stale because the IFC session version changed",
          currentVersionNumber: session.currentVersionNumber,
        },
        { status: 409 }
      );
    }

    const currentState = (session.workflowState || "draft") as WorkflowState;

    if (currentState === "report_generated") {
      const snapshotId = session.currentValidationSnapshotId?.toString();
      const snapshot = snapshotId
        ? await GisValidationSnapshot.findOne({
            _id: new mongoose.Types.ObjectId(snapshotId),
            sessionId: session._id,
            contractorId: new mongoose.Types.ObjectId(contractorId),
            status: "current",
          })
        : null;

      return NextResponse.json({
        validationSnapshot: snapshot
          ? {
              id: snapshot._id.toString(),
              status: snapshot.status,
              ifcVersionNumber: snapshot.ifcVersionNumber,
              completedAt: snapshot.completedAt,
            }
          : null,
        workflow: {
          state: session.workflowState,
          next: "report_generation",
        },
        session: serializeIfcSession(session, await getVersionCount(session._id.toString())),
      });
    }

    const path = workflowPathForCompletion(currentState);
    if (!path) {
      return NextResponse.json(
        { error: `Cannot complete GIS validation from ${currentState}` },
        { status: 409 }
      );
    }
    assertWorkflowPath(currentState, path);

    await GisValidationSnapshot.updateMany(
      { sessionId: session._id, status: "current" },
      { $set: { status: "stale" } }
    );
    await ProjectReport.updateMany(
      { sessionId: session._id, status: "current" },
      { $set: { status: "stale" } }
    );

    const snapshot = await GisValidationSnapshot.create({
      contractorId: new mongoose.Types.ObjectId(contractorId),
      sessionId: session._id,
      ifcVersionId: session.currentVersionId || null,
      ifcVersionNumber: session.currentVersionNumber,
      parcelGeojson: body.parcelGeojson,
      parcelSummary: {
        areaSqm:
          typeof body.parcelSummary?.areaSqm === "number"
            ? body.parcelSummary.areaSqm
            : null,
        centroid: Array.isArray(body.parcelSummary?.centroid)
          ? body.parcelSummary.centroid
          : [],
      },
      modelDimensions: body.modelDimensions,
      rotationDeg: Number(body.rotationDeg || 0),
      roadWarningDistanceM: Number(body.roadWarningDistanceM || 50),
      fitResult,
      status: "current",
      completedAt: new Date(),
    });

    session.workflowState = "land_validated";
    session.currentValidationSnapshotId = snapshot._id;
    session.currentReportId = null;
    await session.save();

    return NextResponse.json({
      validationSnapshot: {
        id: snapshot._id.toString(),
        status: snapshot.status,
        ifcVersionNumber: snapshot.ifcVersionNumber,
        completedAt: snapshot.completedAt,
      },
      workflow: {
        state: session.workflowState,
        next: "report_generation",
      },
      session: serializeIfcSession(session, await getVersionCount(session._id.toString())),
    });
  } catch (error) {
    console.error("[API/contractor/workflow/gis-completions][POST] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.startsWith("Invalid workflow transition") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
