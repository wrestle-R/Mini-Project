import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcVersion from "@/lib/models/IfcVersion";
import IfcChatMessage from "@/lib/models/IfcChatMessage";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { createIfcVersionSnapshot, getVersionCount } from "@/lib/ifc/sessions";
import { serializeIfcSession } from "@/lib/ifc/serializers";

function sameAssets(
  session: {
    currentGlbFileId: string;
    currentJsonFileId: string;
    currentMetadataFileId: string;
  },
  version: {
    glbFileId: string;
    jsonFileId: string;
    metadataFileId: string;
  }
) {
  return (
    session.currentGlbFileId === version.glbFileId &&
    session.currentJsonFileId === version.jsonFileId &&
    session.currentMetadataFileId === version.metadataFileId
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const contractorId = getContractorIdFromAuthHeader(
      req.headers.get("authorization")
    );
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const mode = body?.mode === "undo" || body?.mode === "reset" ? body.mode : "version";
    const versionId = typeof body?.versionId === "string" ? body.versionId : null;

    await dbConnect();
    const session = await IfcSession.findOne({
      _id: new mongoose.Types.ObjectId(id),
      contractorId: new mongoose.Types.ObjectId(contractorId),
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const versions = await IfcVersion.find({ sessionId: session._id }).sort({
      versionNumber: -1,
    });

    let targetVersion =
      null as (typeof versions extends Array<infer T> ? T : never) | null;

    if (mode === "version") {
      targetVersion =
        versions.find((version) => version._id.toString() === versionId) || null;
    } else if (mode === "reset") {
      targetVersion =
        [...versions]
          .reverse()
          .find((version) => version.source === "upload") ||
        [...versions].reverse()[0] ||
        null;
    } else {
      targetVersion =
        versions.find((version) => !sameAssets(session, version)) || null;
    }

    if (!targetVersion) {
      return NextResponse.json(
        { error: "No rollback target found" },
        { status: 400 }
      );
    }

    if (sameAssets(session, targetVersion)) {
      return NextResponse.json(
        { error: "This version is already active" },
        { status: 409 }
      );
    }

    const rollbackVersion = await createIfcVersionSnapshot({
      sessionId: session._id.toString(),
      contractorId,
      label: `Rollback to v${targetVersion.versionNumber}: ${targetVersion.label}`,
      source: "rollback",
      glbFileId: targetVersion.glbFileId,
      jsonFileId: targetVersion.jsonFileId,
      metadataFileId: targetVersion.metadataFileId,
      restoredFromVersionId: targetVersion._id.toString(),
    });

    session.currentGlbFileId = rollbackVersion.glbFileId;
    session.currentJsonFileId = rollbackVersion.jsonFileId;
    session.currentMetadataFileId = rollbackVersion.metadataFileId;
    session.currentVersionId = rollbackVersion._id;
    session.currentVersionNumber = rollbackVersion.versionNumber;
    await session.save();

    const assistantDoc = await IfcChatMessage.create({
      sessionId: session._id,
      role: "assistant",
      content: `Restored the model to v${targetVersion.versionNumber}.`,
      explanation: `Rollback created a new current checkpoint at v${rollbackVersion.versionNumber}.`,
      plan: [
        `Locate v${targetVersion.versionNumber}`,
        "Promote that snapshot to the current session state",
        "Record a rollback checkpoint",
      ],
      actions: [
        {
          type: "rollback",
          restoredFromVersionNumber: targetVersion.versionNumber,
          newVersionNumber: rollbackVersion.versionNumber,
        },
      ],
      versionId: rollbackVersion._id,
      versionNumber: rollbackVersion.versionNumber,
      timestamp: new Date(),
    });

    const versionCount = await getVersionCount(session._id.toString());

    return NextResponse.json({
      session: serializeIfcSession(session, versionCount),
      assistantMessage: {
        id: assistantDoc._id.toString(),
        role: assistantDoc.role,
        content: assistantDoc.content,
        explanation: assistantDoc.explanation || undefined,
        plan: assistantDoc.plan || [],
        actions: assistantDoc.actions || [],
        error: assistantDoc.error || undefined,
        versionId: assistantDoc.versionId?.toString() || null,
        versionNumber: assistantDoc.versionNumber || null,
        timestamp: assistantDoc.timestamp,
      },
      version: {
        id: rollbackVersion._id.toString(),
        versionNumber: rollbackVersion.versionNumber,
        label: rollbackVersion.label,
        source: rollbackVersion.source,
        createdAt: rollbackVersion.createdAt,
      },
    });
  } catch (error) {
    console.error("[API/contractor/ifc/sessions/:id/rollback][POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
