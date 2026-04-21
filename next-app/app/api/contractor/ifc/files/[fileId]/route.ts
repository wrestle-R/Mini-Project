import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcVersion from "@/lib/models/IfcVersion";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { downloadGridFSFileAsBuffer, getGridFSFileInfo } from "@/lib/ifc/gridfs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const contractorId = getContractorIdFromAuthHeader(
      req.headers.get("authorization")
    );
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = await params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
    }

    await dbConnect();

    const ownerSession = await IfcSession.findOne({
      contractorId: new mongoose.Types.ObjectId(contractorId),
      $or: [
        { currentGlbFileId: fileId },
        { currentJsonFileId: fileId },
        { currentMetadataFileId: fileId },
      ],
    }).select("_id");

    let hasAccess = Boolean(ownerSession);

    if (!hasAccess) {
      const version = await IfcVersion.findOne({
        $or: [
          { glbFileId: fileId },
          { jsonFileId: fileId },
          { metadataFileId: fileId },
        ],
      }).select("sessionId");

      if (version) {
        const versionOwner = await IfcSession.findOne({
          _id: version.sessionId,
          contractorId: new mongoose.Types.ObjectId(contractorId),
        }).select("_id");
        hasAccess = Boolean(versionOwner);
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [fileInfo, fileBuffer] = await Promise.all([
      getGridFSFileInfo(fileId),
      downloadGridFSFileAsBuffer(fileId),
    ]);
    if (!fileInfo) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          (fileInfo.contentType as string | undefined) || "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileInfo.filename}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[API/contractor/ifc/files/:fileId][GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
