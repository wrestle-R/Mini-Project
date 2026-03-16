import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IContractorProfile extends Document {
  contractorId: mongoose.Types.ObjectId;
  bio: string;
  logoUrl: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  industry: string;
  companySize: number;
  yearEstablished: number;
  licenseNumber: string;
  taxId: string;
  socialLinks: {
    website: string;
    linkedin: string;
    facebook: string;
    instagram: string;
  };
  languages: string[];
  averageRating: number;
  totalProjectsCompleted: number;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContractorProfileSchema = new Schema<IContractorProfile>(
  {
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: "Contractor",
      required: true,
      unique: true,
      index: true,
    },
    bio: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    logoUrl: {
      type: String,
      default: "",
    },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zipCode: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    industry: {
      type: String,
      default: "General Construction",
    },
    companySize: {
      type: Number,
      default: 1,
      min: 1,
    },
    yearEstablished: {
      type: Number,
      default: new Date().getFullYear(),
    },
    licenseNumber: {
      type: String,
      default: "",
    },
    taxId: {
      type: String,
      default: "",
    },
    socialLinks: {
      website: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },
    languages: {
      type: [String],
      default: ["English"],
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalProjectsCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const ContractorProfile =
  (models.ContractorProfile as mongoose.Model<IContractorProfile>) ||
  model<IContractorProfile>("ContractorProfile", ContractorProfileSchema);

export default ContractorProfile;
