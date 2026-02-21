import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ICompanyProfile extends Document {
  companyId: mongoose.Types.ObjectId;
  bio: string;
  logoUrl: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    lat: number | null;
    lng: number | null;
    displayName: string;
  };
  website: string;
  gstNumber: string;
  panNumber: string;
  yearEstablished: number;
  employeeCount: number;
  socialLinks: {
    linkedin: string;
    facebook: string;
    instagram: string;
    twitter: string;
  };
  languages: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CompanyProfileSchema = new Schema<ICompanyProfile>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
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
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      displayName: { type: String, default: "" },
    },
    website: {
      type: String,
      default: "",
    },
    gstNumber: {
      type: String,
      default: "",
    },
    panNumber: {
      type: String,
      default: "",
    },
    yearEstablished: {
      type: Number,
      default: new Date().getFullYear(),
    },
    employeeCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    socialLinks: {
      linkedin: { type: String, default: "" },
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
    },
    languages: {
      type: [String],
      default: ["English"],
    },
  },
  {
    timestamps: true,
  }
);

const CompanyProfile =
  (models.CompanyProfile as mongoose.Model<ICompanyProfile>) ||
  model<ICompanyProfile>("CompanyProfile", CompanyProfileSchema);

export default CompanyProfile;
