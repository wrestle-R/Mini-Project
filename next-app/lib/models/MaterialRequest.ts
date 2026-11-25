import mongoose, { Schema, Document, models, model } from "mongoose";

export type MaterialRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "fulfilled";

export interface IMaterialRequest extends Document {
  companyId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  requestedByRole: "worker" | "contractor";
  requesterWorkerFirebaseUid: string | null;
  requesterContractorId: mongoose.Types.ObjectId | null;
  materialName: string;
  quantity: number;
  unit: string;
  urgency: "low" | "normal" | "high";
  reason: string;
  status: MaterialRequestStatus;
  companyNote: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialRequestSchema = new Schema<IMaterialRequest>(
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
    requestedByRole: {
      type: String,
      enum: ["worker", "contractor"],
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
    materialName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    urgency: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "fulfilled"],
      default: "pending",
      index: true,
    },
    companyNote: {
      type: String,
      default: "",
      trim: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const MaterialRequest =
  (models.MaterialRequest as mongoose.Model<IMaterialRequest>) ||
  model<IMaterialRequest>("MaterialRequest", MaterialRequestSchema);

export default MaterialRequest;
