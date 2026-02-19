import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IContractor extends Document {
  email: string;
  password: string; // hashed
  firstName: string;
  lastName: string;
  phone: string;
  photoUrl: string;
  companyId: mongoose.Types.ObjectId;
  role: string;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContractorSchema = new Schema<IContractor>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
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
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    role: {
      type: String,
      default: "contractor",
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
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
