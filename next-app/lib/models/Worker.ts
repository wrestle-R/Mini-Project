import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IWorker extends Document {
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  photoUrl: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerSchema = new Schema<IWorker>(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      default: "",
    },
    firstName: {
      type: String,
      default: "",
    },
    lastName: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    photoUrl: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "worker",
    },
  },
  {
    timestamps: true,
  }
);

const Worker =
  (models.Worker as mongoose.Model<IWorker>) ||
  model<IWorker>("Worker", WorkerSchema);

export default Worker;
