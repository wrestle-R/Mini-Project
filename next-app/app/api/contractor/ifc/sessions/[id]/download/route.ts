import { NextResponse } from "next/server";
import mongoose from "mongoose";
import JSZip from "jszip";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { downloadGridFSFileAsBuffer } from "@/lib/ifc/gridfs";

export async function GET(
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

    const [glbBuffer, jsonBuffer] = await Promise.all([
      downloadGridFSFileAsBuffer(session.currentGlbFileId),
      downloadGridFSFileAsBuffer(session.currentJsonFileId),
    ]);

    const zip = new JSZip();
    zip.file("model.glb", glbBuffer);
    zip.file("model.json", jsonBuffer);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${session.title.replace(/\.ifc$/i, "") || "ifc-model"}.zip"`,
      },
    });
  } catch (error) {
    console.error("[API/contractor/ifc/sessions/:id/download][GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
