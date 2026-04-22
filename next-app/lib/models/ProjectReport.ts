import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IProjectReport extends Document {
  contractorId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  validationSnapshotId: mongoose.Types.ObjectId;
  ifcVersionId: mongoose.Types.ObjectId | null;
  ifcVersionNumber: number;
  versionNumber: number;
  status: "current" | "stale" | "approved";
  report: Record<string, unknown>;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectReportSchema = new Schema<IProjectReport>(
  {
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: "Contractor",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "IfcSession",
      required: true,
      index: true,
    },
    validationSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "GisValidationSnapshot",
      required: true,
      index: true,
    },
    ifcVersionId: {
      type: Schema.Types.ObjectId,
      ref: "IfcVersion",
      default: null,
    },
    ifcVersionNumber: { type: Number, required: true, min: 0 },
    versionNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["current", "stale", "approved"],
      default: "current",
      index: true,
    },
    report: { type: Schema.Types.Mixed, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ProjectReportSchema.index({ sessionId: 1, versionNumber: 1 }, { unique: true });
ProjectReportSchema.index({ sessionId: 1, status: 1, createdAt: -1 });

const ProjectReport =
  (models.ProjectReport as mongoose.Model<IProjectReport>) ||
  model<IProjectReport>("ProjectReport", ProjectReportSchema);

export default ProjectReport;
