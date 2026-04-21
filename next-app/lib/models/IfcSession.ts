import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IIfcSession extends Document {
  contractorId: mongoose.Types.ObjectId;
  title: string;
  sourceFileName: string;
  status: "active" | "archived";
  pythonProjectId: string;
  currentGlbFileId: string;
  currentJsonFileId: string;
  currentMetadataFileId: string;
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
    pythonProjectId: { type: String, required: true },
    currentGlbFileId: { type: String, required: true },
    currentJsonFileId: { type: String, required: true },
    currentMetadataFileId: { type: String, required: true },
    lastSavedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const IfcSession =
  (models.IfcSession as mongoose.Model<IIfcSession>) ||
  model<IIfcSession>("IfcSession", IfcSessionSchema);

export default IfcSession;
