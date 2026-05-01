import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ICompanyReportSettings extends Document {
  companyId: mongoose.Types.ObjectId;
  recipients: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CompanyReportSettingsSchema = new Schema<ICompanyReportSettings>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
      index: true,
    },
    recipients: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const CompanyReportSettings =
  (models.CompanyReportSettings as mongoose.Model<ICompanyReportSettings>) ||
  model<ICompanyReportSettings>(
    "CompanyReportSettings",
    CompanyReportSettingsSchema
  );

export default CompanyReportSettings;
