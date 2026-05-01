import mongoose, { Schema, Document, models, model } from "mongoose";

export type DailyReportRole = "worker" | "contractor" | "company";

export interface IDailyReport extends Document {
  companyId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  requesterRole: DailyReportRole;
  requesterWorkerFirebaseUid: string | null;
  requesterContractorId: mongoose.Types.ObjectId | null;
  reportDate: Date;
  workSummary: string;
  manpowerCount: number;
  materialsUsed: string;
  blockers: string;
  nextDayPlan: string;
  attachments: string[];
  notes: string;
  stableKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailyReportSchema = new Schema<IDailyReport>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    requesterRole: {
      type: String,
      enum: ["worker", "contractor", "company"],
      required: true,
      index: true,
    },
    requesterWorkerFirebaseUid: {
      type: String,
      default: null,
      index: true,
    },
    requesterContractorId: {
      type: Schema.Types.ObjectId,
      ref: "Contractor",
      default: null,
      index: true,
    },
    reportDate: {
      type: Date,
      required: true,
      index: true,
    },
    workSummary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    manpowerCount: {
      type: Number,
      default: 1,
      min: 0,
    },
    materialsUsed: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    blockers: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    nextDayPlan: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    attachments: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    stableKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

DailyReportSchema.index({ companyId: 1, projectId: 1, reportDate: -1 });
DailyReportSchema.index({ projectId: 1, requesterRole: 1, reportDate: -1 });

const DailyReport =
  (models.DailyReport as mongoose.Model<IDailyReport>) ||
  model<IDailyReport>("DailyReport", DailyReportSchema);

export default DailyReport;
