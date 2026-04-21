import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcVersion from "@/lib/models/IfcVersion";
import { buildPythonAssetUrl } from "@/lib/ifc/python";
import { uploadBufferToGridFS } from "@/lib/ifc/gridfs";
import mongoose from "mongoose";

async function fetchBinary(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch asset ${url} (${res.status})`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

export async function ingestPythonAssetsToGridFS(params: {
  sessionId?: string;
  projectId: string;
  modelUrl: string;
  jsonUrl: string;
  metadataUrl: string;
}) {
  const [glbBuffer, jsonBuffer, metadataBuffer] = await Promise.all([
    fetchBinary(buildPythonAssetUrl(params.modelUrl)),
    fetchBinary(buildPythonAssetUrl(params.jsonUrl)),
    fetchBinary(buildPythonAssetUrl(params.metadataUrl)),
  ]);

  const [glbFileId, jsonFileId, metadataFileId] = await Promise.all([
    uploadBufferToGridFS({
      buffer: glbBuffer,
      filename: `${params.projectId}.glb`,
      contentType: "model/gltf-binary",
      metadata: { projectId: params.projectId, sessionId: params.sessionId, kind: "glb" },
    }),
    uploadBufferToGridFS({
      buffer: jsonBuffer,
      filename: `${params.projectId}.json`,
      contentType: "application/json",
      metadata: { projectId: params.projectId, sessionId: params.sessionId, kind: "json" },
    }),
    uploadBufferToGridFS({
      buffer: metadataBuffer,
      filename: `${params.projectId}_metadata.json`,
      contentType: "application/json",
      metadata: { projectId: params.projectId, sessionId: params.sessionId, kind: "metadata" },
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
