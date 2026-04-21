import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcChatMessage from "@/lib/models/IfcChatMessage";
import IfcVersion from "@/lib/models/IfcVersion";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { downloadGridFSFileAsBuffer } from "@/lib/ifc/gridfs";
import { applyInstructionToModel, type IfcModelRecord } from "@/lib/ifc/engine";
import { normalizeIfcInstructionWithGroq } from "@/lib/ifc/groq";
import {
  createIfcVersionSnapshot,
  getVersionCount,
  persistIfcModelAssets,
} from "@/lib/ifc/sessions";
import { serializeIfcSession } from "@/lib/ifc/serializers";

function isUndoCommand(message: string) {
  return /\b(undo|revert|go back|reverse)\b/.test(message) && !/\bversion\b/.test(message);
}

function isResetCommand(message: string) {
  return /\b(reset|restore)\b/.test(message) && /\b(original|upload|start|initial)\b/.test(message);
}

function parseRequestedVersion(message: string) {
  const match = message.match(/\b(?:version|v)\s*(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function cloneIfcModel(model: IfcModelRecord) {
  return JSON.parse(JSON.stringify(model)) as IfcModelRecord;
}

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

async function createHistoryReply(params: {
  session: InstanceType<typeof IfcSession>;
  contractorId: string;
  userMessage: string;
  mode: "undo" | "reset" | "version";
  requestedVersion?: number | null;
}) {
  const versions = await IfcVersion.find({ sessionId: params.session._id }).sort({
    versionNumber: -1,
  });

  let targetVersion =
    null as (typeof versions extends Array<infer T> ? T : never) | null;

  if (params.mode === "version") {
    targetVersion =
      versions.find((version) => version.versionNumber === params.requestedVersion) || null;
  } else if (params.mode === "reset") {
    targetVersion =
      [...versions]
        .reverse()
        .find((version) => version.source === "upload") ||
      [...versions].reverse()[0] ||
      null;
  } else {
    targetVersion =
      versions.find((version) => !sameAssets(params.session, version)) || null;
  }

  if (!targetVersion) {
    return {
      updated: false,
      assistantDoc: await IfcChatMessage.create({
        sessionId: params.session._id,
        role: "assistant",
        content:
          params.mode === "version" && params.requestedVersion
            ? `I could not find version ${params.requestedVersion}.`
            : "No rollback target is available yet.",
        explanation: "The requested history state does not exist.",
        timestamp: new Date(),
      }),
    };
  }

  if (sameAssets(params.session, targetVersion)) {
    return {
      updated: false,
      assistantDoc: await IfcChatMessage.create({
        sessionId: params.session._id,
        role: "assistant",
        content: `v${targetVersion.versionNumber} is already the current model state.`,
        explanation: "Requested rollback target matches the current IFC assets.",
        timestamp: new Date(),
      }),
    };
  }

  const rollbackVersion = await createIfcVersionSnapshot({
    sessionId: params.session._id.toString(),
    contractorId: params.contractorId,
    label: `Rollback to v${targetVersion.versionNumber}: ${targetVersion.label}`,
    source: "rollback",
    glbFileId: targetVersion.glbFileId,
    jsonFileId: targetVersion.jsonFileId,
    metadataFileId: targetVersion.metadataFileId,
    restoredFromVersionId: targetVersion._id.toString(),
  });

  params.session.currentGlbFileId = rollbackVersion.glbFileId;
  params.session.currentJsonFileId = rollbackVersion.jsonFileId;
  params.session.currentMetadataFileId = rollbackVersion.metadataFileId;
  params.session.currentVersionId = rollbackVersion._id;
  params.session.currentVersionNumber = rollbackVersion.versionNumber;
  await params.session.save();

  const assistantDoc = await IfcChatMessage.create({
    sessionId: params.session._id,
    role: "assistant",
    content:
      params.mode === "undo"
        ? `Undid the last IFC change and restored v${targetVersion.versionNumber}.`
        : params.mode === "reset"
        ? `Reset the model back to the original upload at v${targetVersion.versionNumber}.`
        : `Restored the model to v${targetVersion.versionNumber}.`,
    explanation: `Created rollback checkpoint v${rollbackVersion.versionNumber} from the requested history state.`,
    plan: [
      "Locate the requested historical snapshot",
      "Promote it to the active session",
      "Write a new rollback checkpoint for future undo",
    ],
    actions: [
      {
        type: params.mode === "undo" ? "undo" : "rollback",
        restoredFromVersionNumber: targetVersion.versionNumber,
        newVersionNumber: rollbackVersion.versionNumber,
        prompt: params.userMessage,
      },
    ],
    versionId: rollbackVersion._id,
    versionNumber: rollbackVersion.versionNumber,
    timestamp: new Date(),
  });

  return { updated: true, assistantDoc };
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
    const message = body?.message?.trim();
    const selectedContexts = Array.isArray(body?.selectedContexts) ? body.selectedContexts : [];

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    await dbConnect();
    const session = await IfcSession.findOne({
      _id: new mongoose.Types.ObjectId(id),
      contractorId: new mongoose.Types.ObjectId(contractorId),
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await IfcChatMessage.create({
      sessionId: session._id,
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    let assistantDoc;
    let updated = false;

    const requestedVersion = parseRequestedVersion(message);
    if (isUndoCommand(message)) {
      const historyResult = await createHistoryReply({
        session,
        contractorId,
        userMessage: message,
        mode: "undo",
      });
      assistantDoc = historyResult.assistantDoc;
      updated = historyResult.updated;
    } else if (isResetCommand(message)) {
      const historyResult = await createHistoryReply({
        session,
        contractorId,
        userMessage: message,
        mode: "reset",
      });
      assistantDoc = historyResult.assistantDoc;
      updated = historyResult.updated;
    } else if (requestedVersion) {
      const historyResult = await createHistoryReply({
        session,
        contractorId,
        userMessage: message,
        mode: "version",
        requestedVersion,
      });
      assistantDoc = historyResult.assistantDoc;
      updated = historyResult.updated;
    } else {
      const jsonBuffer = await downloadGridFSFileAsBuffer(session.currentJsonFileId);
      const baseModel = JSON.parse(jsonBuffer.toString("utf-8")) as IfcModelRecord;
      const directResult = applyInstructionToModel(
        cloneIfcModel(baseModel),
        message,
        selectedContexts
      );

      const normalized = await normalizeIfcInstructionWithGroq({
        message,
        selectedContexts,
      });

      let effectiveInstruction = message;
      let result = directResult;

      if (normalized?.instruction) {
        const groqResult = applyInstructionToModel(
          cloneIfcModel(baseModel),
          normalized.instruction,
          selectedContexts
        );

        const preferGroq =
          groqResult.updated &&
          (
            !directResult.updated ||
            selectedContexts.length > 0 ||
            normalized.instruction.trim().toLowerCase() !== message.trim().toLowerCase()
          );

        if (preferGroq) {
          result = {
            ...groqResult,
            assistant: {
              ...groqResult.assistant,
              explanation: normalized.reason
                ? `${groqResult.assistant.explanation} ${normalized.reason}`
                : groqResult.assistant.explanation,
            },
          } as any;
          effectiveInstruction = normalized.instruction;
        } else if (!directResult.updated) {
          result = {
            ...groqResult,
            assistant: {
              ...groqResult.assistant,
              explanation: normalized.reason
                ? `${groqResult.assistant.explanation} ${normalized.reason}`
                : groqResult.assistant.explanation,
            },
          } as any;
          effectiveInstruction = normalized.instruction;
        }
      }

      let chatVersion:
        | {
            _id: mongoose.Types.ObjectId;
            versionNumber: number;
          }
        | null = null;

      if (result.updated) {
        const newAssets = await persistIfcModelAssets({
          sessionId: session._id.toString(),
          model: result.model,
        });
        session.currentGlbFileId = newAssets.glbFileId;
        session.currentJsonFileId = newAssets.jsonFileId;
        session.currentMetadataFileId = newAssets.metadataFileId;

        const createdVersion = await createIfcVersionSnapshot({
          sessionId: session._id.toString(),
          contractorId,
          label: `Chat edit: ${effectiveInstruction.slice(0, 80).trim()}`,
          source: "chat",
          glbFileId: newAssets.glbFileId,
          jsonFileId: newAssets.jsonFileId,
          metadataFileId: newAssets.metadataFileId,
        });

        session.currentVersionId = createdVersion._id;
        session.currentVersionNumber = createdVersion.versionNumber;
        await session.save();
        updated = true;
        chatVersion = createdVersion;
      }

      assistantDoc = await IfcChatMessage.create({
        sessionId: session._id,
        role: "assistant",
        content: result.assistant.content,
        explanation: result.assistant.explanation || "",
        plan: result.assistant.plan || [],
        actions: result.assistant.actions || [],
        versionId: chatVersion?._id || null,
        versionNumber: chatVersion?.versionNumber || null,
        timestamp: new Date(),
      });
    }

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
      updated,
    });
  } catch (error) {
    console.error("[API/contractor/ifc/sessions/:id/chat][POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
