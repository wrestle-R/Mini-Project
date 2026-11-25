import mongoose, { Document, Schema, model, models } from "mongoose";

export interface IAttendance extends Document {
  externalKey: string;
  recognizedId: string | null;
  recognizedName: string;
  score: number;
  status: "success" | "failure";
  reason: string;
  time: Date;
  source: string;
  frameUrl: string;
  livenessPassed: boolean;
  ppe: {
    hard_hat: boolean;
    vest: boolean;
    compliant: boolean;
  } | null;
  diagnostics: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    externalKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    recognizedId: {
      type: String,
      default: null,
      index: true,
    },
    recognizedName: {
      type: String,
      default: "Unknown",
    },
    score: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["success", "failure"],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: "",
    },
    time: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      default: "",
      index: true,
    },
    frameUrl: {
      type: String,
      default: "",
    },
    livenessPassed: {
      type: Boolean,
      default: false,
    },
    ppe: {
      hard_hat: { type: Boolean, default: false },
      vest: { type: Boolean, default: false },
      compliant: { type: Boolean, default: false },
    },
    diagnostics: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Attendance =
  (models.Attendance as mongoose.Model<IAttendance>) ||
  model<IAttendance>("Attendance", AttendanceSchema);

export default Attendance;
