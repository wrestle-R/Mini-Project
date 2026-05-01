import mongoose from "mongoose";
import Project from "@/lib/models/Project";
import ProjectApplication from "@/lib/models/ProjectApplication";
import ProjectContractorAssignment from "@/lib/models/ProjectContractorAssignment";

export type ReportActor =
  | { role: "worker"; uid: string; email: string }
  | { role: "contractor"; id: string }
  | { role: "company"; id: string };

export type ReportProjectOption = {
  id: string;
  title: string;
  status: string;
};

function serializeProject(project: {
  _id: { toString(): string };
  title?: string;
  status?: string;
}): ReportProjectOption {
  return {
    id: project._id.toString(),
    title: project.title || "Untitled project",
    status: project.status || "planning",
  };
}

export function startOfReportDay(dateValue: string | Date) {
  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function nextReportDay(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

export async function getActorReportProjects(
  actor: ReportActor
): Promise<ReportProjectOption[]> {
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

export function objectIdsFromProjects(projects: ReportProjectOption[]) {
  return projects
    .map((project) => project.id)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}
