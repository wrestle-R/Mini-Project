import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IIfcVersion extends Document {
  sessionId: mongoose.Types.ObjectId;
  versionNumber: number;
  label: string;
  glbFileId: string;
  jsonFileId: string;
  metadataFileId: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IfcVersionSchema = new Schema<IIfcVersion>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "IfcSession",
      required: true,
      index: true,
    },
    versionNumber: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, trim: true },
    glbFileId: { type: String, required: true },
    jsonFileId: { type: String, required: true },
    metadataFileId: { type: String, required: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Contractor",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

IfcVersionSchema.index({ sessionId: 1, versionNumber: 1 }, { unique: true });

const IfcVersion =
  (models.IfcVersion as mongoose.Model<IIfcVersion>) ||
  model<IIfcVersion>("IfcVersion", IfcVersionSchema);

export default IfcVersion;
