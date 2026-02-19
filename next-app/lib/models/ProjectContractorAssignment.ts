import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IProjectContractorAssignment extends Document {
  projectId: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId | null;
  companyId: mongoose.Types.ObjectId;
  status: "assigned" | "in-progress" | "completed" | "removed";
  notes: string;
  assignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectContractorAssignmentSchema =
  new Schema<IProjectContractorAssignment>(
    {
      projectId: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true,
        index: true,
      },
      contractorId: {
        type: Schema.Types.ObjectId,
        ref: "Contractor",
        required: true,
        index: true,
      },
      customerId: {
        type: Schema.Types.ObjectId,
        ref: "Customer",
        default: null,
      },
      companyId: {
        type: Schema.Types.ObjectId,
        ref: "Company",
        required: true,
        index: true,
      },
      status: {
        type: String,
        enum: ["assigned", "in-progress", "completed", "removed"],
        default: "assigned",
      },
      notes: {
        type: String,
        default: "",
      },
      assignedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      timestamps: true,
    }
  );

const ProjectContractorAssignment =
  (models.ProjectContractorAssignment as mongoose.Model<IProjectContractorAssignment>) ||
  model<IProjectContractorAssignment>(
    "ProjectContractorAssignment",
    ProjectContractorAssignmentSchema
  );

export default ProjectContractorAssignment;
