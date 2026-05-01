import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import MaterialRequest, {
  type MaterialRequestStatus,
} from "@/lib/models/MaterialRequest";
import Project from "@/lib/models/Project";
import ProjectApplication from "@/lib/models/ProjectApplication";
import ProjectContractorAssignment from "@/lib/models/ProjectContractorAssignment";
import Worker from "@/lib/models/Worker";
import "@/lib/models/Company";
import "@/lib/models/Contractor";

type Actor =
  | { role: "worker"; uid: string; email: string }
  | { role: "contractor"; id: string }
  | { role: "company"; id: string };

type ProjectOption = {
  id: string;
  title: string;
  status: string;
};

const VALID_STATUSES: MaterialRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "fulfilled",
];

async function verifyFirebaseToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      uid: payload.user_id || payload.sub,
      email: payload.email || "",
    };
  } catch {
    return null;
  }
}

async function resolveActor(req: Request): Promise<Actor | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const bearer = authHeader.split("Bearer ")[1];
  const customPayload = verifyCustomToken(bearer);
  if (customPayload?.role === "company") {
    return { role: "company", id: customPayload.id };
  }
  if (customPayload?.role === "contractor") {
    return { role: "contractor", id: customPayload.id };
  }

  const firebaseUser = await verifyFirebaseToken(authHeader);
  if (!firebaseUser?.uid) return null;
  return { role: "worker", uid: firebaseUser.uid, email: firebaseUser.email };
}

function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

function serializeProject(project: {
  _id: { toString(): string };
  title?: string;
  status?: string;
}): ProjectOption {
  return {
    id: project._id.toString(),
    title: project.title || "Untitled project",
    status: project.status || "planning",
  };
}

async function getActorProjects(actor: Actor): Promise<ProjectOption[]> {
  if (actor.role === "company") {
    const projects = await Project.find({ companyId: actor.id })
      .select("title status")
      .sort({ createdAt: -1 });
    return projects.map(serializeProject);
  }

  if (actor.role === "contractor") {
    const assignments = await ProjectContractorAssignment.find({
      contractorId: actor.id,
      status: { $ne: "removed" },
    })
      .populate("projectId", "title status")
      .sort({ createdAt: -1 });

    return assignments
      .map((assignment) => assignment.projectId as unknown)
      .filter(
        (
          project
        ): project is {
          _id: { toString(): string };
          title?: string;
          status?: string;
        } => Boolean(project && typeof project === "object" && "_id" in project)
      )
      .map(serializeProject);
  }

  const applications = await ProjectApplication.find({
    workerFirebaseUid: actor.uid,
    status: "accepted",
  }).select("projectId");
  const projectIds = applications.map((application) => application.projectId);
  const projects = await Project.find({ _id: { $in: projectIds } })
    .select("title status")
    .sort({ createdAt: -1 });
  return projects.map(serializeProject);
}

async function getRequestFilter(actor: Actor) {
  if (actor.role === "company") return { companyId: actor.id };

  if (actor.role === "contractor") {
    const assignments = await ProjectContractorAssignment.find({
      contractorId: actor.id,
      status: { $ne: "removed" },
    }).select("projectId");
    return {
      projectId: { $in: assignments.map((assignment) => assignment.projectId) },
    };
  }

  return { requesterWorkerFirebaseUid: actor.uid };
}

async function serializeRequests(requests: Array<Record<string, unknown>>) {
  const workerUids = [
    ...new Set(
      requests
        .map((request) => request.requesterWorkerFirebaseUid)
        .filter((uid): uid is string => typeof uid === "string" && uid.length > 0)
    ),
  ];
  const workers = await Worker.find({ firebaseUid: { $in: workerUids } }).select(
    "firebaseUid firstName lastName email"
  );
  const workerMap = new Map(
    workers.map((worker) => [
      worker.firebaseUid,
      [worker.firstName, worker.lastName].filter(Boolean).join(" ") ||
        worker.email ||
        "Worker",
    ])
  );

  return requests.map((request) => {
    const project = request.projectId as
      | { _id?: { toString(): string }; title?: string; status?: string }
      | undefined;
    const contractor = request.requesterContractorId as
      | { firstName?: string; lastName?: string; email?: string }
      | null
      | undefined;
    const contractorName = contractor
      ? [contractor.firstName, contractor.lastName].filter(Boolean).join(" ") ||
        contractor.email ||
        "Contractor"
      : null;

    return {
      id: String(request._id),
      project: project?._id
        ? {
            id: project._id.toString(),
            title: project.title || "Untitled project",
            status: project.status || "planning",
          }
        : null,
      requestedByRole: request.requestedByRole,
      requesterName:
        request.requestedByRole === "worker"
          ? workerMap.get(String(request.requesterWorkerFirebaseUid)) || "Worker"
          : contractorName || "Contractor",
      materialName: request.materialName,
      quantity: request.quantity,
      unit: request.unit,
      urgency: request.urgency,
      reason: request.reason,
      status: request.status,
      companyNote: request.companyNote,
      resolvedAt: request.resolvedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  });
}

export async function GET(req: Request) {
  try {
    const actor = await resolveActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const [projects, filter] = await Promise.all([
      getActorProjects(actor),
      getRequestFilter(actor),
    ]);

    const requests = await MaterialRequest.find(filter)
      .populate("projectId", "title status")
      .populate("requesterContractorId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      projects,
      requests: await serializeRequests(requests),
    });
  } catch (error) {
    console.error("[API/material-requests][GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    if (!actor || actor.role === "company") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const projectId = body?.projectId;
    const materialName = String(body?.materialName || "").trim();
    const unit = String(body?.unit || "").trim();
    const reason = String(body?.reason || "").trim();
    const quantity = Number(body?.quantity);
    const urgency = ["low", "normal", "high"].includes(body?.urgency)
      ? body.urgency
      : "normal";

    if (!isValidObjectId(projectId)) {
      return NextResponse.json({ error: "Project is required" }, { status: 400 });
    }
    if (!materialName || !unit || !reason || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Material, quantity, unit, and reason are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const project = await Project.findById(projectId).select("companyId");
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (actor.role === "worker") {
      const acceptedApplication = await ProjectApplication.findOne({
        projectId,
        workerFirebaseUid: actor.uid,
        status: "accepted",
      });
      if (!acceptedApplication) {
        return NextResponse.json({ error: "Project access denied" }, { status: 403 });
      }
    }

    let contractorId: mongoose.Types.ObjectId | null = null;
    if (actor.role === "contractor") {
      const assignment = await ProjectContractorAssignment.findOne({
        projectId,
        contractorId: actor.id,
        status: { $ne: "removed" },
      });
      if (!assignment) {
        return NextResponse.json({ error: "Project access denied" }, { status: 403 });
      }
      contractorId = new mongoose.Types.ObjectId(actor.id);
    }

    const request = await MaterialRequest.create({
      companyId: project.companyId,
      projectId,
      requestedByRole: actor.role,
      requesterWorkerFirebaseUid: actor.role === "worker" ? actor.uid : null,
      requesterContractorId: contractorId,
      materialName,
      quantity,
      unit,
      urgency,
      reason,
    });

    return NextResponse.json({ request: { id: request._id.toString() } });
  } catch (error) {
    console.error("[API/material-requests][POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await resolveActor(req);
    if (!actor || actor.role !== "company") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const requestId = body?.requestId;
    const status = body?.status as MaterialRequestStatus | undefined;
    const companyNote = String(body?.companyNote || "").trim();

    if (!isValidObjectId(requestId) || !status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid request update" }, { status: 400 });
    }

    await dbConnect();

    const request = await MaterialRequest.findOne({
      _id: requestId,
      companyId: actor.id,
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    request.status = status;
    request.companyNote = companyNote;
    request.resolvedAt = status === "pending" ? null : new Date();
    await request.save();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API/material-requests][PATCH] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
