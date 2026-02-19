import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ICompany extends Document {
  email: string;
  password: string; // hashed
  name: string;
  sector: string;
  phone: string;
  logoUrl: string;
  role: string;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
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
    name: {
      type: String,
      default: "",
    },
    sector: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    logoUrl: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "company",
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

const Company =
  (models.Company as mongoose.Model<ICompany>) ||
  model<ICompany>("Company", CompanySchema);

export default Company;
