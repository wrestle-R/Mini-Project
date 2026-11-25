interface SessionLike {
  _id: { toString(): string };
  title: string;
  sourceFileName: string;
  status: string;
  projectId: string;
  currentGlbFileId: string;
  currentJsonFileId: string;
  currentMetadataFileId: string;
  currentVersionId?: { toString(): string } | string | null;
  currentVersionNumber?: number;
  workflowState?: string;
  currentValidationSnapshotId?: { toString(): string } | string | null;
  currentReportId?: { toString(): string } | string | null;
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
    projectId: session.projectId,
    currentGlbFileId: session.currentGlbFileId,
    currentJsonFileId: session.currentJsonFileId,
    currentMetadataFileId: session.currentMetadataFileId,
    currentGlbUrl: `/api/contractor/ifc/files/${session.currentGlbFileId}`,
    currentJsonUrl: `/api/contractor/ifc/files/${session.currentJsonFileId}`,
    currentMetadataUrl: `/api/contractor/ifc/files/${session.currentMetadataFileId}`,
    currentVersionId: session.currentVersionId
      ? session.currentVersionId.toString()
      : null,
    currentVersionNumber: session.currentVersionNumber || 0,
    workflowState: session.workflowState || "draft",
    currentValidationSnapshotId: session.currentValidationSnapshotId
      ? session.currentValidationSnapshotId.toString()
      : null,
    currentReportId: session.currentReportId
      ? session.currentReportId.toString()
      : null,
    versionCount,
    lastSavedAt: session.lastSavedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
