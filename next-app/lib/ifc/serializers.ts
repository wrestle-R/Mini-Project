interface SessionLike {
  _id: { toString(): string };
  title: string;
  sourceFileName: string;
  status: string;
  pythonProjectId: string;
  currentGlbFileId: string;
  currentJsonFileId: string;
  currentMetadataFileId: string;
  lastSavedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeIfcSession(
  session: SessionLike,
  versionCount: number
) {
  return {
    id: session._id.toString(),
    title: session.title,
    sourceFileName: session.sourceFileName,
    status: session.status,
    pythonProjectId: session.pythonProjectId,
    currentGlbFileId: session.currentGlbFileId,
    currentJsonFileId: session.currentJsonFileId,
    currentMetadataFileId: session.currentMetadataFileId,
    currentGlbUrl: `/api/contractor/ifc/files/${session.currentGlbFileId}`,
    currentJsonUrl: `/api/contractor/ifc/files/${session.currentJsonFileId}`,
    currentMetadataUrl: `/api/contractor/ifc/files/${session.currentMetadataFileId}`,
    versionCount,
    lastSavedAt: session.lastSavedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
