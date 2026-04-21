const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required");
}

const ProjectSchema = new mongoose.Schema(
  {
    title: String,
    location: mongoose.Schema.Types.Mixed,
  },
  { collection: "projects", strict: false }
);

const Project = mongoose.models.ProjectMigration || mongoose.model("ProjectMigration", ProjectSchema);

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function normalizeLocation(input) {
  if (typeof input === "string") {
    return {
      displayName: input.trim(),
      lat: null,
      lng: null,
    };
  }

  if (input && typeof input === "object") {
    return {
      displayName: typeof input.displayName === "string" ? input.displayName.trim() : "",
      lat: typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null,
      lng: typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : null,
    };
  }

  return {
    displayName: "",
    lat: null,
    lng: null,
  };
}

async function run() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  const projects = await Project.find({}).select("title location");

  let updated = 0;
  for (const project of projects) {
    const normalized = normalizeLocation(project.location);

    if (
      normalized.displayName &&
      normalized.lat !== null &&
      normalized.lng !== null
    ) {
      continue;
    }

    project.location = {
      displayName: normalized.displayName || `${project.title || "Project"} Site`,
      lat: Number(randomInRange(8.0, 36.0).toFixed(6)),
      lng: Number(randomInRange(68.0, 97.0).toFixed(6)),
    };

    await project.save();
    updated += 1;
  }

  console.log(`Migration complete. Updated ${updated} project(s).`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
