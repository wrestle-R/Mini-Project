import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IProjectApplication extends Document {
  projectId: mongoose.Types.ObjectId;
  workerFirebaseUid: string;
  status: "pending" | "accepted" | "rejected";
  message: string;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectApplicationSchema = new Schema<IProjectApplication>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    workerFirebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    message: {
      type: String,
      default: "",
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const ProjectApplication =
  (models.ProjectApplication as mongoose.Model<IProjectApplication>) ||
  model<IProjectApplication>("ProjectApplication", ProjectApplicationSchema);

export default ProjectApplication;
