import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcVersion from "@/lib/models/IfcVersion";
import { uploadBufferToGridFS } from "@/lib/ifc/gridfs";
import {
  createMetadataFromModel,
  generateGlbFromModel,
  type IfcModelRecord,
} from "@/lib/ifc/engine";
import mongoose from "mongoose";

export type IfcVersionSource = "upload" | "chat" | "manual" | "rollback";

export async function persistIfcModelAssets(params: {
  sessionId?: string;
  model: IfcModelRecord;
}) {
  const metadata = createMetadataFromModel(params.model);
  const [glbBuffer, jsonBuffer, metadataBuffer] = await Promise.all([
    generateGlbFromModel(params.model),
    Promise.resolve(Buffer.from(JSON.stringify(params.model, null, 2), "utf-8")),
    Promise.resolve(Buffer.from(JSON.stringify(metadata, null, 2), "utf-8")),
  ]);

  const [glbFileId, jsonFileId, metadataFileId] = await Promise.all([
    uploadBufferToGridFS({
      buffer: glbBuffer,
      filename: `${params.model.project_id}.glb`,
      contentType: "model/gltf-binary",
      metadata: { projectId: params.model.project_id, sessionId: params.sessionId, kind: "glb" },
    }),
    uploadBufferToGridFS({
      buffer: jsonBuffer,
      filename: `${params.model.project_id}.json`,
      contentType: "application/json",
      metadata: { projectId: params.model.project_id, sessionId: params.sessionId, kind: "json" },
    }),
    uploadBufferToGridFS({
      buffer: metadataBuffer,
      filename: `${params.model.project_id}_metadata.json`,
      contentType: "application/json",
      metadata: { projectId: params.model.project_id, sessionId: params.sessionId, kind: "metadata" },
    }),
  ]);

  return { glbFileId, jsonFileId, metadataFileId };
}

export async function getOwnedIfcSessionOrNull(sessionId: string, contractorId: string) {
  await dbConnect();
  return IfcSession.findOne({
    _id: sessionId,
    contractorId: new mongoose.Types.ObjectId(contractorId),
  });
}

export async function getVersionCount(sessionId: string) {
  await dbConnect();
  return IfcVersion.countDocuments({ sessionId: new mongoose.Types.ObjectId(sessionId) });
}

export async function createIfcVersionSnapshot(params: {
  sessionId: string;
  contractorId: string;
  label: string;
  source: IfcVersionSource;
  glbFileId: string;
  jsonFileId: string;
  metadataFileId: string;
  restoredFromVersionId?: string | null;
}) {
  await dbConnect();

  const latestVersion = await IfcVersion.findOne({
    sessionId: new mongoose.Types.ObjectId(params.sessionId),
  })
    .sort({ versionNumber: -1 })
    .select("versionNumber");

  const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

  return IfcVersion.create({
    sessionId: new mongoose.Types.ObjectId(params.sessionId),
    versionNumber: nextVersionNumber,
    label: params.label,
    source: params.source,
    glbFileId: params.glbFileId,
    jsonFileId: params.jsonFileId,
    metadataFileId: params.metadataFileId,
    createdBy: new mongoose.Types.ObjectId(params.contractorId),
    restoredFromVersionId: params.restoredFromVersionId
      ? new mongoose.Types.ObjectId(params.restoredFromVersionId)
      : null,
  });
}
