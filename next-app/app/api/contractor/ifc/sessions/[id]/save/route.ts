import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { createIfcVersionSnapshot } from "@/lib/ifc/sessions";
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

    await dbConnect();
    const session = await IfcSession.findOne({
      _id: new mongoose.Types.ObjectId(id),
      contractorId: new mongoose.Types.ObjectId(contractorId),
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const version = await createIfcVersionSnapshot({
      sessionId: session._id.toString(),
      contractorId,
      label:
        body?.label?.trim() || `Manual snapshot ${new Date().toLocaleString()}`,
      source: "manual",
      glbFileId: session.currentGlbFileId,
      jsonFileId: session.currentJsonFileId,
      metadataFileId: session.currentMetadataFileId,
    });

    session.currentVersionId = version._id;
    session.currentVersionNumber = version.versionNumber;
    session.lastSavedAt = new Date();
    await session.save();

    return NextResponse.json({
      session: serializeIfcSession(session, version.versionNumber),
      version: {
        id: version._id.toString(),
        versionNumber: version.versionNumber,
        label: version.label,
        source: version.source,
        createdAt: version.createdAt,
      },
    });
  } catch (error) {
    console.error("[API/contractor/ifc/sessions/:id/save][POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
