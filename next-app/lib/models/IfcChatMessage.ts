import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IIfcChatMessage extends Document {
  sessionId: mongoose.Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  explanation?: string;
  plan?: string[];
  actions?: Record<string, unknown>[];
  error?: string;
  versionId?: mongoose.Types.ObjectId | null;
  versionNumber?: number | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IfcChatMessageSchema = new Schema<IIfcChatMessage>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "IfcSession",
      required: true,
      index: true,
    },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    explanation: { type: String, default: "" },
    plan: { type: [String], default: [] },
    actions: { type: [Schema.Types.Mixed], default: [] },
    error: { type: String, default: "" },
    versionId: {
      type: Schema.Types.ObjectId,
      ref: "IfcVersion",
      default: null,
    },
    versionNumber: { type: Number, default: null },
    timestamp: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

const IfcChatMessage =
  (models.IfcChatMessage as mongoose.Model<IIfcChatMessage>) ||
  model<IIfcChatMessage>("IfcChatMessage", IfcChatMessageSchema);

export default IfcChatMessage;
