import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IProject extends Document {
  companyId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: "planning" | "active" | "on-hold" | "completed" | "cancelled";
  location: {
    displayName: string;
    lat: number | null;
    lng: number | null;
  };
  startDate: Date | null;
  endDate: Date | null;
  budget: number;
  isOpen: boolean; // workers can see and apply
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["planning", "active", "on-hold", "completed", "cancelled"],
      default: "planning",
    },
    location: {
      displayName: {
        type: String,
        default: "",
      },
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    budget: {
      type: Number,
      default: 0,
      min: 0,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Project =
  (models.Project as mongoose.Model<IProject>) ||
  model<IProject>("Project", ProjectSchema);

export default Project;
