import mongoose, { Document, Schema, model, models } from "mongoose";

export interface IGisRankingPreference extends Document {
  contractorId: mongoose.Types.ObjectId;
  weights: {
    fit: number;
    environment: number;
    infrastructure: number;
    utilization: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const GisRankingPreferenceSchema = new Schema<IGisRankingPreference>(
  {
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: "Contractor",
      required: true,
      unique: true,
      index: true,
    },
    weights: {
      fit: { type: Number, required: true, min: 0, max: 100, default: 40 },
      environment: { type: Number, required: true, min: 0, max: 100, default: 20 },
      infrastructure: { type: Number, required: true, min: 0, max: 100, default: 25 },
      utilization: { type: Number, required: true, min: 0, max: 100, default: 15 },
    },
  },
  { timestamps: true }
);

const GisRankingPreference =
  (models.GisRankingPreference as mongoose.Model<IGisRankingPreference>) ||
  model<IGisRankingPreference>("GisRankingPreference", GisRankingPreferenceSchema);

export default GisRankingPreference;
