import mongoose, { Schema, Document, models, model } from "mongoose";
import type { WorkflowState } from "@/lib/workflow/states";

export interface IIfcSession extends Document {
  contractorId: mongoose.Types.ObjectId;
  title: string;
  sourceFileName: string;
  status: "active" | "archived";
  projectId: string;
  currentGlbFileId: string;
  currentJsonFileId: string;
  currentMetadataFileId: string;
  currentVersionId: mongoose.Types.ObjectId | null;
  currentVersionNumber: number;
  workflowState: WorkflowState;
  currentValidationSnapshotId: mongoose.Types.ObjectId | null;
  currentReportId: mongoose.Types.ObjectId | null;
  lastSavedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const IfcSessionSchema = new Schema<IIfcSession>(
  {
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: "Contractor",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    sourceFileName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    projectId: { type: String, required: true },
    currentGlbFileId: { type: String, required: true },
    currentJsonFileId: { type: String, required: true },
    currentMetadataFileId: { type: String, required: true },
    currentVersionId: {
      type: Schema.Types.ObjectId,
      ref: "IfcVersion",
      default: null,
    },
    currentVersionNumber: { type: Number, default: 0, min: 0 },
    workflowState: {
      type: String,
      enum: [
        "draft",
        "design_locked",
        "land_validated",
        "report_generated",
        "company_approved",
        "hiring_open",
        "execution_active",
        "closed",
      ],
      default: "draft",
      index: true,
    },
    currentValidationSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "GisValidationSnapshot",
      default: null,
    },
    currentReportId: {
      type: Schema.Types.ObjectId,
      ref: "ProjectReport",
      default: null,
    },
    lastSavedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const IfcSession =
  (models.IfcSession as mongoose.Model<IIfcSession>) ||
  model<IIfcSession>("IfcSession", IfcSessionSchema);

export default IfcSession;
