import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IContractor extends Document {
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContractorSchema = new Schema<IContractor>(
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
    companyName: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "contractor",
    },
  },
  {
    timestamps: true,
  }
);

const Contractor =
  (models.Contractor as mongoose.Model<IContractor>) ||
  model<IContractor>("Contractor", ContractorSchema);

export default Contractor;
