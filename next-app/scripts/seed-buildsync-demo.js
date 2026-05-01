const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const PROJECT_TITLE = "building the dashboard";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function dayOffset(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function upsert(collection, filter, update) {
  await collection.updateOne(
    filter,
    {
      $set: { ...update, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  return collection.findOne(filter);
}

async function main() {
  loadEnvLocal();
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required in .env.local");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const companies = db.collection("companies");
  const contractors = db.collection("contractors");
  const workers = db.collection("workers");
  const projects = db.collection("projects");
  const assignments = db.collection("projectcontractorassignments");
  const applications = db.collection("projectapplications");
  const materialRequests = db.collection("materialrequests");
  const dailyReports = db.collection("dailyreports");

  const company = await companies.findOne({ email: "raveya@gmail.com" });
  const contractor = await contractors.findOne({ email: "contractor@gmail.com" });
  const worker = await workers.findOne({ email: "worker@gmail.com" });

  if (!company || !contractor || !worker) {
    throw new Error(
      "Expected users not found: worker@gmail.com, contractor@gmail.com, raveya@gmail.com"
    );
  }

  const project = await projects.findOne({
    companyId: company._id,
    title: PROJECT_TITLE,
  });

  if (!project) {
    throw new Error(`Project not found: ${PROJECT_TITLE}`);
  }

  await upsert(
    assignments,
    { projectId: project._id, contractorId: contractor._id },
    {
      projectId: project._id,
      contractorId: contractor._id,
      customerId: null,
      companyId: company._id,
      status: "assigned",
      notes: "need asap",
      assignedAt: project.createdAt || new Date("2026-02-19T00:00:00.000Z"),
    }
  );

  const reportSeeds = [
    {
      role: "company",
      actorKey: company._id.toString(),
      daysAgo: 4,
      summary: "Company reviewed dashboard scope and confirmed the first reporting milestones.",
      manpower: 2,
      materials: "Project documents and dashboard requirements",
      blockers: "",
      next: "Contractor to begin detailed execution updates.",
      notes: "Company-side planning update.",
    },
    {
      role: "contractor",
      actorKey: contractor._id.toString(),
      daysAgo: 3,
      summary: "Contractor checked the assigned dashboard build tasks and prepared the work sequence.",
      manpower: 3,
      materials: "Planning checklist, layout references",
      blockers: "Awaiting final confirmation on urgent items.",
      next: "Start core dashboard structure and send material requirements if needed.",
      notes: "Seeded contractor report for building the dashboard.",
    },
    {
      role: "worker",
      actorKey: worker.firebaseUid,
      daysAgo: 2,
      summary: "Worker completed initial dashboard setup support and verified project details.",
      manpower: 1,
      materials: "Basic tools and reference notes",
      blockers: "",
      next: "Continue assigned dashboard implementation support.",
      notes: "Seeded worker report for building the dashboard.",
    },
    {
      role: "company",
      actorKey: company._id.toString(),
      daysAgo: 1,
      summary: "Company checked daily progress and marked the dashboard work as needing faster follow-up.",
      manpower: 2,
      materials: "Review notes",
      blockers: "Timeline is tight because the project is marked need asap.",
      next: "Review next contractor and worker updates in the daily timeline.",
      notes: "Company follow-up update.",
    },
  ];

  for (const seed of reportSeeds) {
    const reportDate = dayOffset(seed.daysAgo);
    const stableKey = [
      project._id.toString(),
      seed.role,
      seed.actorKey,
      reportDate.toISOString().slice(0, 10),
    ].join(":");

    await upsert(
      dailyReports,
      { stableKey },
      {
        companyId: company._id,
        projectId: project._id,
        requesterRole: seed.role,
        requesterWorkerFirebaseUid: seed.role === "worker" ? worker.firebaseUid : null,
        requesterContractorId: seed.role === "contractor" ? contractor._id : null,
        reportDate,
        workSummary: seed.summary,
        manpowerCount: seed.manpower,
        materialsUsed: seed.materials,
        blockers: seed.blockers,
        nextDayPlan: seed.next,
        attachments: [],
        notes: seed.notes,
        stableKey,
      }
    );
  }

  await upsert(
    applications,
    { projectId: project._id, workerFirebaseUid: worker.firebaseUid },
    {
      projectId: project._id,
      workerFirebaseUid: worker.firebaseUid,
      status: "accepted",
      message: "Linked to building the dashboard.",
      appliedAt: project.createdAt || new Date("2026-02-19T00:00:00.000Z"),
    }
  );

  const counts = {
    projects: await projects.countDocuments({
      companyId: company._id,
      title: PROJECT_TITLE,
    }),
    assignments: await assignments.countDocuments({
      projectId: project._id,
      contractorId: contractor._id,
    }),
    applications: await applications.countDocuments({
      projectId: project._id,
      workerFirebaseUid: worker.firebaseUid,
      status: "accepted",
    }),
    materials: await materialRequests.countDocuments({ projectId: project._id }),
    reports: await dailyReports.countDocuments({ projectId: project._id }),
  };

  console.log("Seed check complete", {
    project: PROJECT_TITLE,
    projectId: project._id.toString(),
    counts,
    note: "No project is created by this script. Reports are upserted for the existing project.",
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
