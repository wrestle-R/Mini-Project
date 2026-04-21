import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcVersion from "@/lib/models/IfcVersion";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";

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

    const latestVersion = await IfcVersion.findOne({ sessionId: session._id })
      .sort({ versionNumber: -1 })
      .select("versionNumber");
    const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    const body = await req.json().catch(() => null);
    const label =
      body?.label?.trim() || `Snapshot v${nextVersionNumber} (${new Date().toLocaleString()})`;

    const version = await IfcVersion.create({
      sessionId: session._id,
      versionNumber: nextVersionNumber,
      label,
      glbFileId: session.currentGlbFileId,
      jsonFileId: session.currentJsonFileId,
      metadataFileId: session.currentMetadataFileId,
      createdBy: new mongoose.Types.ObjectId(contractorId),
    });

    session.lastSavedAt = new Date();
    await session.save();

    return NextResponse.json({
      version: {
        id: version._id.toString(),
        versionNumber: version.versionNumber,
        label: version.label,
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
