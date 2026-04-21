import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcChatMessage from "@/lib/models/IfcChatMessage";
import IfcVersion from "@/lib/models/IfcVersion";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { getPythonApiBaseUrl } from "@/lib/ifc/python";
import { ingestPythonAssetsToGridFS } from "@/lib/ifc/sessions";
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

    const pythonFormData = new FormData();
    pythonFormData.append("file", file);

    const uploadRes = await fetch(`${getPythonApiBaseUrl()}/api/ifc/upload`, {
      method: "POST",
      body: pythonFormData,
    });
    const uploadData = await uploadRes.json().catch(() => null);
    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: uploadData?.detail || "IFC upload failed" },
        { status: uploadRes.status }
      );
    }

    const pythonProjectId = uploadData?.project_id as string;
    const modelUrl = uploadData?.model_url as string;
    const jsonUrl = uploadData?.json_url as string;
    const metadataUrl = uploadData?.metadata_url as string;

    if (!pythonProjectId || !modelUrl || !jsonUrl || !metadataUrl) {
      return NextResponse.json(
        { error: "Python service returned incomplete asset metadata" },
        { status: 502 }
      );
    }

    await dbConnect();

    const sessionDoc = await IfcSession.create({
      contractorId: new mongoose.Types.ObjectId(contractorId),
      title: file.name,
      sourceFileName: file.name,
      status: "active",
      pythonProjectId,
      currentGlbFileId: "",
      currentJsonFileId: "",
      currentMetadataFileId: "",
    });

    const assetRefs = await ingestPythonAssetsToGridFS({
      sessionId: sessionDoc._id.toString(),
      projectId: pythonProjectId,
      modelUrl,
      jsonUrl,
      metadataUrl,
    });

    sessionDoc.currentGlbFileId = assetRefs.glbFileId;
    sessionDoc.currentJsonFileId = assetRefs.jsonFileId;
    sessionDoc.currentMetadataFileId = assetRefs.metadataFileId;
    await sessionDoc.save();

    await IfcChatMessage.create({
      sessionId: sessionDoc._id,
      role: "assistant",
      content: "Model uploaded successfully. You can start editing with chat instructions.",
      timestamp: new Date(),
    });

    return NextResponse.json({
      session: serializeIfcSession(sessionDoc, 0),
    });
  } catch (error) {
    console.error("[API/contractor/ifc/sessions][POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
