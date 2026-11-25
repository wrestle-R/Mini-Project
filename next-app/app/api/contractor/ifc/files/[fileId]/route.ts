import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Contractor from "@/lib/models/Contractor";
import IfcSession from "@/lib/models/IfcSession";
import IfcVersion from "@/lib/models/IfcVersion";
import { getIfcActorFromAuthHeader } from "@/lib/ifc/auth";
import { downloadGridFSFileAsBuffer, getGridFSFileInfo } from "@/lib/ifc/gridfs";

type SessionAccess = {
  _id: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const actor = getIfcActorFromAuthHeader(req.headers.get("authorization"));
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = await params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
    }

    await dbConnect();

    let session = await IfcSession.findOne({
      $or: [
        { currentGlbFileId: fileId },
        { currentJsonFileId: fileId },
        { currentMetadataFileId: fileId },
      ],
    })
      .select("_id contractorId")
      .lean<SessionAccess | null>();

    if (!session) {
      const version = await IfcVersion.findOne({
        $or: [
          { glbFileId: fileId },
          { jsonFileId: fileId },
          { metadataFileId: fileId },
        ],
      }).select("sessionId");

      if (version) {
        session = await IfcSession.findById(version.sessionId)
          .select("_id contractorId")
          .lean<SessionAccess | null>();
      }
    }

    let hasAccess = false;
    if (session && actor.role === "contractor") {
      hasAccess = session.contractorId.toString() === actor.id;
    }
    if (session && actor.role === "company") {
      const contractor = await Contractor.findOne({
        _id: session.contractorId,
        companyId: actor.id,
      }).select("_id");
      hasAccess = Boolean(contractor);
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
