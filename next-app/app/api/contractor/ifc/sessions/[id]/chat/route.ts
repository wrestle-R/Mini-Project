import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcChatMessage from "@/lib/models/IfcChatMessage";
import IfcVersion from "@/lib/models/IfcVersion";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { getPythonApiBaseUrl, buildPythonAssetUrl } from "@/lib/ifc/python";
import { ingestPythonAssetsToGridFS } from "@/lib/ifc/sessions";
import { serializeIfcSession } from "@/lib/ifc/serializers";

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
    const selectedContexts = Array.isArray(body?.selectedContexts)
      ? body.selectedContexts
      : [];

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

    const pythonForm = new FormData();
    pythonForm.append("message", message);
    if (selectedContexts.length > 0) {
      pythonForm.append("selected_contexts", JSON.stringify(selectedContexts));
    }

    const chatRes = await fetch(
      `${getPythonApiBaseUrl()}/api/chat/${session.pythonProjectId}`,
      { method: "POST", body: pythonForm }
    );
    const chatData = await chatRes.json().catch(() => null);

    if (!chatRes.ok || chatData?.status === "error") {
      const errorMsg =
        chatData?.message || `Chat request failed (${chatRes.status})`;
      await IfcChatMessage.create({
        sessionId: session._id,
        role: "assistant",
        content: "Error",
        error: errorMsg,
        timestamp: new Date(),
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    let newAssets:
      | {
          glbFileId: string;
          jsonFileId: string;
          metadataFileId: string;
        }
      | undefined;

    const modelUrl = chatData?.model_url as string | undefined;
    if (modelUrl) {
      const jsonUrl = `/data/models/${session.pythonProjectId}.json`;
      const metadataUrl =
        chatData?.metadata_url ||
        `/data/models/${session.pythonProjectId}_metadata.json`;

      newAssets = await ingestPythonAssetsToGridFS({
        sessionId: session._id.toString(),
        projectId: session.pythonProjectId,
        modelUrl: buildPythonAssetUrl(modelUrl),
        jsonUrl: buildPythonAssetUrl(jsonUrl),
        metadataUrl: buildPythonAssetUrl(metadataUrl),
      });

      session.currentGlbFileId = newAssets.glbFileId;
      session.currentJsonFileId = newAssets.jsonFileId;
      session.currentMetadataFileId = newAssets.metadataFileId;
      await session.save();
    }

    const assistantDoc = await IfcChatMessage.create({
      sessionId: session._id,
      role: "assistant",
      content: chatData?.reply || chatData?.explanation || chatData?.message || "Changes applied.",
      explanation: chatData?.explanation || "",
      plan: Array.isArray(chatData?.plan) ? chatData.plan : [],
      actions: Array.isArray(chatData?.actions) ? chatData.actions : [],
      timestamp: new Date(),
    });

    const versionCount = await IfcVersion.countDocuments({ sessionId: session._id });

    return NextResponse.json({
      session: serializeIfcSession(session, versionCount),
      assistantMessage: {
        id: assistantDoc._id.toString(),
        role: assistantDoc.role,
        content: assistantDoc.content,
        explanation: assistantDoc.explanation || undefined,
        plan: assistantDoc.plan || [],
        actions: assistantDoc.actions || [],
        timestamp: assistantDoc.timestamp,
      },
      updated: Boolean(newAssets),
    });
  } catch (error) {
    console.error("[API/contractor/ifc/sessions/:id/chat][POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
