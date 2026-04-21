import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcChatMessage from "@/lib/models/IfcChatMessage";
import IfcVersion from "@/lib/models/IfcVersion";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { createModelFromIfcBuffer } from "@/lib/ifc/engine";
import { createIfcVersionSnapshot, persistIfcModelAssets } from "@/lib/ifc/sessions";
import { serializeIfcSession } from "@/lib/ifc/serializers";

export async function GET(req: Request) {
  try {
    const contractorId = getContractorIdFromAuthHeader(
      req.headers.get("authorization")
    );
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const sessions = await IfcSession.find({
      contractorId: new mongoose.Types.ObjectId(contractorId),
    }).sort({ updatedAt: -1 });

    const sessionIds = sessions.map((s) => s._id);
    const versionAgg = await IfcVersion.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      { $group: { _id: "$sessionId", count: { $sum: 1 } } },
    ]);
    const versionMap = new Map<string, number>();
    for (const row of versionAgg) {
      versionMap.set(row._id.toString(), row.count);
    }

    return NextResponse.json({
      sessions: sessions.map((session) =>
        serializeIfcSession(session, versionMap.get(session._id.toString()) || 0)
      ),
    });
  } catch (error) {
    console.error("[API/contractor/ifc/sessions][GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".ifc")) {
      return NextResponse.json(
        { error: "Only .ifc files are accepted" },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const modelRecord = await createModelFromIfcBuffer(fileBuffer, file.name);
    const projectId = modelRecord.project_id;

    await dbConnect();

    const sessionDoc = new IfcSession({
      contractorId: new mongoose.Types.ObjectId(contractorId),
      title: file.name,
      sourceFileName: file.name,
      status: "active",
      projectId,
      currentGlbFileId: "pending",
      currentJsonFileId: "pending",
      currentMetadataFileId: "pending",
    });

    const assetRefs = await persistIfcModelAssets({
      sessionId: sessionDoc._id.toString(),
      model: modelRecord,
    });

    sessionDoc.currentGlbFileId = assetRefs.glbFileId;
    sessionDoc.currentJsonFileId = assetRefs.jsonFileId;
    sessionDoc.currentMetadataFileId = assetRefs.metadataFileId;
    await sessionDoc.save();

    const uploadVersion = await createIfcVersionSnapshot({
      sessionId: sessionDoc._id.toString(),
      contractorId,
      label: "Original upload",
      source: "upload",
      glbFileId: sessionDoc.currentGlbFileId,
      jsonFileId: sessionDoc.currentJsonFileId,
      metadataFileId: sessionDoc.currentMetadataFileId,
    });

    sessionDoc.currentVersionId = uploadVersion._id;
    sessionDoc.currentVersionNumber = uploadVersion.versionNumber;
    await sessionDoc.save();

    await IfcChatMessage.create({
      sessionId: sessionDoc._id,
      role: "assistant",
      content:
        "Model uploaded successfully. The original state is saved as v1, and every edit can be rolled back.",
      versionId: uploadVersion._id,
      versionNumber: uploadVersion.versionNumber,
      timestamp: new Date(),
    });

    return NextResponse.json({
      session: serializeIfcSession(sessionDoc, 1),
    });
  } catch (error) {
    console.error("[API/contractor/ifc/sessions][POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
