import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IWorkAvailability {
  status: "available" | "busy" | "offline";
  availableFrom?: Date;
}

export interface IEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface IWorkerProfile extends Document {
  firebaseUid: string;
  bio: string;
  profilePhotoUrl: string;
  skills: string[];
  tradeSpecialties: string[];
  experienceYears: number;
  hourlyRate: number;
  availability: IWorkAvailability;
  location: {
    city: string;
    state: string;
    country: string;
    zipCode: string;
    lat: number | null;
    lng: number | null;
    displayName: string;
    street: string;
  };
  languages: string[];
  emergencyContact: IEmergencyContact;
  preferredWorkTypes: string[];
  toolsOwned: string[];
  hasVehicle: boolean;
  willingToRelocate: boolean;
  createdAt: Date;
  updatedAt: Date;
}



const WorkerProfileSchema = new Schema<IWorkerProfile>(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bio: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    profilePhotoUrl: {
      type: String,
      default: "",
    },
    skills: {
      type: [String],
      default: [],
    },
    tradeSpecialties: {
      type: [String],
      default: [],
      // e.g. ["Carpentry", "Electrical", "Plumbing", "Masonry", "Painting"]
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    hourlyRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    availability: {
      status: {
        type: String,
        enum: ["available", "busy", "offline"],
        default: "available",
      },
      availableFrom: {
        type: Date,
        default: null,
      },
    },
    location: {
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      zipCode: { type: String, default: "" },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      displayName: { type: String, default: "" },
      street: { type: String, default: "" },
    },
    languages: {
      type: [String],
      default: ["English"],
    },
    emergencyContact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      relationship: { type: String, default: "" },
    },
    preferredWorkTypes: {
      type: [String],
      default: [],
      // e.g. ["Full-time", "Part-time", "Contract", "Daily Labor"]
    },
    toolsOwned: {
      type: [String],
      default: [],
    },
    hasVehicle: {
      type: Boolean,
      default: false,
    },
    willingToRelocate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const WorkerProfile =
  (models.WorkerProfile as mongoose.Model<IWorkerProfile>) ||
  model<IWorkerProfile>("WorkerProfile", WorkerProfileSchema);

export default WorkerProfile;
