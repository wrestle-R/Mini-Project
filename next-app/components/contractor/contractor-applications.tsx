"use client";

import { useState, useEffect, useCallback } from "react";
import { useContractor } from "@/contexts/ContractorContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FiUsers,
  FiMapPin,
  FiCalendar,
  FiStar,
  FiTool,
  FiClock,
  FiCheck,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiUser,
  FiBriefcase,
  FiAward,
} from "react-icons/fi";

/* ─────────────────── Types ─────────────────── */

interface Project {
  title: string;
  status: string;
  location: string;
}

interface Application {
  id: string;
  projectId: string;
  project: Project | null;
  workerFirebaseUid: string;
  status: "pending" | "accepted" | "rejected";
  message: string;
  appliedAt: string;
}

interface WorkerData {
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  photoUrl: string;
  memberSince: string;
}

interface WorkerProfile {
  bio: string;
  profilePhotoUrl: string;
  skills: string[];
  tradeSpecialties: string[];
  experienceYears: number;
  hourlyRate: number;
  availability: { status: string };
  location: { city: string; state: string; country: string };
  languages: string[];
  certifications: { name: string; issuingBody: string; year: number }[];
  preferredWorkTypes: string[];
  toolsOwned: string[];
  hasVehicle: boolean;
  willingToRelocate: boolean;
}

interface JobHistoryItem {
  applicationId: string;
  project: {
    id: string;
    title: string;
    status: string;
    location: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  appliedAt: string;
}

interface WorkerFull {
  worker: WorkerData;
  profile: WorkerProfile | null;
  jobHistory: JobHistoryItem[];
}

/* ─────────────────── Status helpers ─────────────────── */

function statusVariant(s: string) {
  if (s === "accepted") return "default";
  if (s === "rejected") return "destructive";
  return "secondary";
}

function availabilityColor(s?: string) {
  if (s === "available") return "text-green-600";
  if (s === "busy") return "text-yellow-500";
  return "text-muted-foreground";
}

/* ─────────────────── Worker Profile Drawer ─────────────────── */

function WorkerProfilePanel({
  uid,
  token,
  onClose,
}: {
  uid: string;
  token: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<WorkerFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/contractor/workers/${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load");
        setData(await res.json());
      } catch {
        toast.error("Could not load worker profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid, token]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const { worker, profile, jobHistory } = data;
  const displayName =
    [worker.firstName, worker.lastName].filter(Boolean).join(" ") ||
    worker.email;

  return (
    <div className="space-y-6 p-6 overflow-y-auto max-h-[75vh]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {profile?.profilePhotoUrl || worker.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile?.profilePhotoUrl || worker.photoUrl}
              alt={displayName}
              className="h-14 w-14 rounded-full object-cover border"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-lg">{displayName}</p>
            <p className="text-sm text-muted-foreground">{worker.email}</p>
            {profile?.availability && (
              <p
                className={`text-xs font-medium mt-0.5 ${availabilityColor(
                  profile.availability.status
                )}`}
              >
                {profile.availability.status}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <FiX className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Bio */}
      {profile?.bio && (
        <div>
          <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground mb-1">
            About
          </p>
          <p className="text-sm">{profile.bio}</p>
        </div>
      )}

      {/* Key stats */}
      {profile && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {profile.experienceYears > 0 && (
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{profile.experienceYears}</p>
              <p className="text-xs text-muted-foreground">yrs experience</p>
            </div>
          )}
          {profile.hourlyRate > 0 && (
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">${profile.hourlyRate}</p>
              <p className="text-xs text-muted-foreground">hourly rate</p>
            </div>
          )}
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{jobHistory.length}</p>
            <p className="text-xs text-muted-foreground">jobs completed</p>
          </div>
        </div>
      )}

      {/* Trade specialties */}
      {profile?.tradeSpecialties && profile.tradeSpecialties.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <FiTool className="h-3.5 w-3.5" /> Specialties
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.tradeSpecialties.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {profile?.skills && profile.skills.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <FiStar className="h-3.5 w-3.5" /> Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((s) => (
              <Badge key={s} variant="outline" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {profile?.certifications && profile.certifications.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <FiAward className="h-3.5 w-3.5" /> Certifications
          </p>
          <ul className="space-y-1">
            {profile.certifications.map((c, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-muted-foreground">
                  — {c.issuingBody}, {c.year}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Location & misc */}
      {profile?.location && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {(profile.location.city || profile.location.state) && (
            <span className="flex items-center gap-1">
              <FiMapPin className="h-3.5 w-3.5" />
              {[profile.location.city, profile.location.state]
                .filter(Boolean)
                .join(", ")}
            </span>
          )}
          {profile.hasVehicle && (
            <span className="flex items-center gap-1">
              <FiCheck className="h-3.5 w-3.5 text-green-600" /> Has vehicle
            </span>
          )}
          {profile.willingToRelocate && (
            <span className="flex items-center gap-1">
              <FiCheck className="h-3.5 w-3.5 text-green-600" /> Willing to
              relocate
            </span>
          )}
        </div>
      )}

      <Separator />

      {/* Job history */}
      <div>
        <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground mb-3 flex items-center gap-1">
          <FiBriefcase className="h-3.5 w-3.5" /> Job History (accepted)
        </p>
        {jobHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No accepted jobs yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {jobHistory.map((j) => (
              <li
                key={j.applicationId}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {j.project?.title || "Unknown project"}
                </p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                  {j.project?.location && (
                    <span className="flex items-center gap-1">
                      <FiMapPin className="h-3 w-3" /> {j.project.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <FiCalendar className="h-3 w-3" />{" "}
                    {new Date(j.appliedAt).toLocaleDateString()}
                  </span>
                  {j.project?.status && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {j.project.status}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Project Applications Row ─────────────────── */

function ProjectApplicationsRow({
  projectId,
  projectTitle,
  projectStatus,
  projectLocation,
  apps,
  token,
  onStatusChange,
}: {
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  projectLocation: string;
  apps: Application[];
  token: string;
  onStatusChange: (appId: string, newStatus: "accepted" | "rejected") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [viewingUid, setViewingUid] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const pendingCount = apps.filter((a) => a.status === "pending").length;

  const handleStatusChange = async (
    appId: string,
    status: "accepted" | "rejected"
  ) => {
    setUpdating(appId);
    try {
      const res = await fetch(`/api/contractor/applications/${appId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      onStatusChange(appId, status);
      toast.success(
        status === "accepted"
          ? "Application accepted"
          : "Application rejected"
      );
    } catch {
      toast.error("Failed to update application");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{projectTitle}</CardTitle>
            <CardDescription className="flex gap-3 mt-1">
              <span className="flex items-center gap-1">
                <FiMapPin className="h-3.5 w-3.5" /> {projectLocation || "—"}
              </span>
              <span className="flex items-center gap-1">
                <FiUsers className="h-3.5 w-3.5" /> {apps.length} applicant
                {apps.length !== 1 ? "s" : ""}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{projectStatus}</Badge>
            {pendingCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400">
                {pendingCount} pending
              </Badge>
            )}
            {expanded ? (
              <FiChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FiChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="apps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <CardContent className="pt-0 space-y-3">
              {apps.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No applications yet.
                </p>
              ) : (
                apps.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        Worker ID:{" "}
                        <span className="font-mono text-xs text-muted-foreground">
                          {app.workerFirebaseUid}
                        </span>
                      </p>
                      {app.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-2">
                          "{app.message}"
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={statusVariant(app.status)}>
                          {app.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FiClock className="h-3 w-3" />
                          {new Date(app.appliedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setViewingUid(app.workerFirebaseUid)}
                      >
                        <FiUser className="h-3.5 w-3.5" /> Profile
                      </Button>
                      {app.status === "pending" && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-1"
                            disabled={updating === app.id}
                            onClick={() =>
                              handleStatusChange(app.id, "accepted")
                            }
                          >
                            <FiCheck className="h-3.5 w-3.5" /> Accept
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1"
                            disabled={updating === app.id}
                            onClick={() =>
                              handleStatusChange(app.id, "rejected")
                            }
                          >
                            <FiX className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Worker profile panel */}
              <AnimatePresence>
                {viewingUid && (
                  <motion.div
                    key="profile-panel"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl border bg-muted/30 mt-3"
                  >
                    <WorkerProfilePanel
                      uid={viewingUid}
                      token={token}
                      onClose={() => setViewingUid(null)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ─────────────────── Main Component ─────────────────── */

export function ContractorApplications() {
  const { token } = useContractor();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/contractor/applications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setApplications(data.applications || []);
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Group applications by project
  const grouped = applications.reduce<
    Record<string, { project: Project | null; apps: Application[] }>
  >((acc, app) => {
    if (!acc[app.projectId]) {
      acc[app.projectId] = { project: app.project, apps: [] };
    }
    acc[app.projectId].apps.push(app);
    return acc;
  }, {});

  const handleStatusChange = (appId: string, newStatus: "accepted" | "rejected") => {
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const projectEntries = Object.entries(grouped);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Worker Applications</h1>
        <p className="text-muted-foreground">
          Review and manage applications from workers for your assigned projects.
        </p>
      </div>

      {projectEntries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FiUsers className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">
              No worker applications yet
            </p>
            <p className="text-sm text-muted-foreground/70">
              Applications from workers will appear here once they apply to your
              projects.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projectEntries.map(([projectId, { project, apps }]) => (
            <ProjectApplicationsRow
              key={projectId}
              projectId={projectId}
              projectTitle={project?.title || "Untitled Project"}
              projectStatus={project?.status || "—"}
              projectLocation={project?.location || ""}
              apps={apps}
              token={token!}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
