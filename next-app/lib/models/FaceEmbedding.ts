import mongoose, { Document, Schema, model, models } from "mongoose";

export interface IFaceEmbedding extends Document {
  subjectType: "worker" | "contractor";
  subjectId: string;
  imageUrl: string;
  embedding: number[];
  embeddingModel: string;
  dim: number;
  version: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FaceEmbeddingSchema = new Schema<IFaceEmbedding>(
  {
    subjectType: {
      type: String,
      enum: ["worker", "contractor"],
      required: true,
      index: true,
    },
    subjectId: {
      type: String,
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    embedding: {
      type: [Number],
      default: [],
    },
    embeddingModel: {
      type: String,
      default: "facenet-pytorch",
    },
    dim: {
      type: Number,
      default: 512,
    },
    version: {
      type: String,
      default: "vggface2-inceptionresnetv1",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

FaceEmbeddingSchema.index(
  { subjectType: 1, subjectId: 1 },
  { unique: true, name: "face_embedding_subject_unique" }
);

const FaceEmbedding =
  (models.FaceEmbedding as mongoose.Model<IFaceEmbedding>) ||
  model<IFaceEmbedding>("FaceEmbedding", FaceEmbeddingSchema);

export default FaceEmbedding;
