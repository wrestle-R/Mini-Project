import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IGisValidationSnapshot extends Document {
  contractorId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  ifcVersionId: mongoose.Types.ObjectId | null;
  ifcVersionNumber: number;
  parcelGeojson: Record<string, unknown>;
  parcelSummary: {
    areaSqm: number | null;
    centroid: number[];
  };
  modelDimensions: {
    width_m: number;
    depth_m: number;
    height_m: number;
    up_axis?: "y" | "z";
  };
  rotationDeg: number;
  roadWarningDistanceM: number;
  fitResult: Record<string, unknown>;
  status: "current" | "stale";
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GisValidationSnapshotSchema = new Schema<IGisValidationSnapshot>(
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
    ifcVersionId: {
      type: Schema.Types.ObjectId,
      ref: "IfcVersion",
      default: null,
    },
    ifcVersionNumber: { type: Number, required: true, min: 0 },
    parcelGeojson: { type: Schema.Types.Mixed, required: true },
    parcelSummary: {
      areaSqm: { type: Number, default: null },
      centroid: { type: [Number], default: [] },
    },
    modelDimensions: {
      width_m: { type: Number, required: true },
      depth_m: { type: Number, required: true },
      height_m: { type: Number, required: true },
      up_axis: { type: String, enum: ["y", "z"], required: false },
    },
    rotationDeg: { type: Number, required: true },
    roadWarningDistanceM: { type: Number, required: true },
    fitResult: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["current", "stale"],
      default: "current",
      index: true,
    },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

GisValidationSnapshotSchema.index({ sessionId: 1, status: 1, createdAt: -1 });

const GisValidationSnapshot =
  (models.GisValidationSnapshot as mongoose.Model<IGisValidationSnapshot>) ||
  model<IGisValidationSnapshot>("GisValidationSnapshot", GisValidationSnapshotSchema);

export default GisValidationSnapshot;
