"use client";

import { useState, useEffect, useCallback } from "react";
import { useContractor } from "@/contexts/ContractorContext";
import { useRouter } from "next/navigation";
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
  FiArrowLeft,
  FiMapPin,
  FiCalendar,
  FiDollarSign,
  FiUser,
  FiMail,
  FiPhone,
  FiCheck,
  FiX,
  FiClock,
  FiUsers,
  FiStar,
  FiTool,
  FiAward,
  FiBriefcase,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";

/* ─────────────── Types ─────────────── */

type Tab = "pending" | "accepted" | "rejected" | "all";

interface WorkerInfo {
  firstName: string;
  lastName: string;
  email: string;
  photoUrl: string;
  phone: string;
}

interface Application {
  id: string;
  workerFirebaseUid: string;
  worker: WorkerInfo | null;
  status: "pending" | "accepted" | "rejected";
  message: string;
  appliedAt: string;
}

interface ProjectInfo {
  id: string;
  title: string;
  description: string;
  status: string;
  location: { displayName: string; lat: number | null; lng: number | null };
  startDate: string | null;
  endDate: string | null;
  budget: number;
  isOpen: boolean;
}

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

interface AssignmentDetail {
  assignment: { id: string; status: string; notes: string; assignedAt: string };
  project: ProjectInfo;
  customer: CustomerInfo | null;
  applications: Application[];
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

interface WorkerFull {
  worker: {
    firebaseUid: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    photoUrl: string;
    memberSince: string;
  };
  profile: WorkerProfile | null;
  jobHistory: {
    applicationId: string;
    project: {
      id: string;
      title: string;
      status: string;
      location: { displayName: string; lat: number | null; lng: number | null };
      startDate: string | null;
      endDate: string | null;
    } | null;
    appliedAt: string;
  }[];
}

/* ─────────────── Tab Button ─────────────── */

function TabBtn({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`ml-1.5 inline-flex items-center justify-center text-[10px] rounded-full px-1.5 py-0.5 ${
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted-foreground/20 text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/* ─────────────── Worker Profile Panel ─────────────── */

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
    (async () => {
      try {
        const res = await fetch(`/api/contractor/workers/${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        toast.error("Could not load worker profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, token]);

  if (loading) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (!data) return null;

  const { worker, profile, jobHistory } = data;
  const name =
    [worker.firstName, worker.lastName].filter(Boolean).join(" ") ||
    worker.email;

  const availColor = (s?: string) =>
    s === "available"
      ? "text-green-600"
      : s === "busy"
      ? "text-yellow-500"
      : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-xl border bg-muted/30 p-5 space-y-5 overflow-y-auto max-h-[60vh]"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{worker.email}</p>
          {worker.phone && (
            <p className="text-xs text-muted-foreground">{worker.phone}</p>
          )}
          {profile?.availability && (
            <p
              className={`text-xs font-medium mt-0.5 ${availColor(
                profile.availability.status
              )}`}
            >
              ● {profile.availability.status}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <FiX className="h-4 w-4" />
        </Button>
      </div>

      {profile?.bio && <p className="text-sm">{profile.bio}</p>}

      {/* Stats */}
      {profile && (
        <div className="grid grid-cols-3 gap-2">
          {profile.experienceYears > 0 && (
            <div className="rounded-lg border p-2 text-center">
              <p className="text-lg font-bold">{profile.experienceYears}</p>
              <p className="text-[10px] text-muted-foreground">yrs exp</p>
            </div>
          )}
          {profile.hourlyRate > 0 && (
            <div className="rounded-lg border p-2 text-center">
              <p className="text-lg font-bold">${profile.hourlyRate}</p>
              <p className="text-[10px] text-muted-foreground">hourly</p>
            </div>
          )}
          <div className="rounded-lg border p-2 text-center">
            <p className="text-lg font-bold">{jobHistory.length}</p>
            <p className="text-[10px] text-muted-foreground">jobs</p>
          </div>
        </div>
      )}

      {/* Specialties */}
      {profile?.tradeSpecialties && profile.tradeSpecialties.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <FiTool className="h-3 w-3" /> Specialties
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.tradeSpecialties.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {profile?.skills && profile.skills.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <FiStar className="h-3 w-3" /> Skills
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.skills.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Certs */}
      {profile?.certifications && profile.certifications.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <FiAward className="h-3 w-3" /> Certifications
          </p>
          <ul className="space-y-0.5">
            {profile.certifications.map((c, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-muted-foreground">
                  — {c.issuingBody}, {c.year}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Location */}
      {profile?.location && (profile.location.city || profile.location.state) && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FiMapPin className="h-3 w-3" />
            {[profile.location.city, profile.location.state]
              .filter(Boolean)
              .join(", ")}
          </span>
          {profile.hasVehicle && (
            <span className="flex items-center gap-1">
              <FiCheck className="h-3 w-3 text-green-600" /> Vehicle
            </span>
          )}
        </div>
      )}

      <Separator />

      {/* Job history */}
      <div>
        <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <FiBriefcase className="h-3 w-3" /> Job History
        </p>
        {jobHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No jobs yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {jobHistory.map((j) => (
              <li
                key={j.applicationId}
                className="rounded-lg border px-2.5 py-1.5 text-xs"
              >
                <p className="font-medium">
                  {j.project?.title || "Unknown"}
                </p>
                <div className="flex gap-2 mt-0.5 text-muted-foreground">
                  {j.project?.location && (
                    <span className="flex items-center gap-0.5">
                      <FiMapPin className="h-2.5 w-2.5" />
                      {j.project.location.displayName || "Location pending"}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <FiCalendar className="h-2.5 w-2.5" />{" "}
                    {new Date(j.appliedAt).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────── Main Component ─────────────── */

export function ContractorProjectDetail({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const { token } = useContractor();
  const router = useRouter();
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [viewingUid, setViewingUid] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/contractor/assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      toast.error("Failed to load project details");
    } finally {
      setLoading(false);
    }
  }, [token, assignmentId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleStatusChange = async (
    appId: string,
    status: "accepted" | "rejected"
  ) => {
    if (!token) return;
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
      if (!res.ok) throw new Error();
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          applications: prev.applications.map((a) =>
            a.id === appId ? { ...a, status } : a
          ),
        };
      });
      toast.success(
        status === "accepted" ? "Worker accepted" : "Application rejected"
      );
    } catch {
      toast.error("Failed to update");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Project not found.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/contractor/projects")}
          >
            <FiArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { project, customer, applications, assignment } = data;

  const pending = applications.filter((a) => a.status === "pending");
  const accepted = applications.filter((a) => a.status === "accepted");
  const rejected = applications.filter((a) => a.status === "rejected");

  const filtered =
    tab === "all"
      ? applications
      : tab === "pending"
      ? pending
      : tab === "accepted"
      ? accepted
      : rejected;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2"
        onClick={() => router.push("/contractor/projects")}
      >
        <FiArrowLeft className="h-4 w-4" /> Back to Projects
      </Button>

      {/* Project header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{project.title}</CardTitle>
              <CardDescription className="mt-1">
                {project.description || "No description."}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{project.status}</Badge>
              <Badge variant="secondary">{assignment.status}</Badge>
              {project.isOpen && (
                <Badge className="bg-primary text-white border-0">
                  Open
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
            {project.location && (
              <span className="flex items-center gap-1">
                <FiMapPin className="h-3.5 w-3.5" />
                {project.location.displayName || "Location pending"}
              </span>
            )}
            {project.budget > 0 && (
              <span className="flex items-center gap-1">
                <FiDollarSign className="h-3.5 w-3.5" /> ₹
                {project.budget.toLocaleString()}
              </span>
            )}
            {project.startDate && (
              <span className="flex items-center gap-1">
                <FiCalendar className="h-3.5 w-3.5" />{" "}
                {new Date(project.startDate).toLocaleDateString()}
                {project.endDate &&
                  ` – ${new Date(project.endDate).toLocaleDateString()}`}
              </span>
            )}
          </div>

          {customer && (
            <div className="mt-4 rounded-lg border p-3 space-y-1">
              <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                Customer
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <FiUser className="h-3.5 w-3.5" /> {customer.name}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <FiMail className="h-3.5 w-3.5" /> {customer.email}
                  </span>
                )}
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <FiPhone className="h-3.5 w-3.5" /> {customer.phone}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Applications section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiUsers className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Worker Applications</h2>
            <span className="text-sm text-muted-foreground">
              ({applications.length})
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
          <TabBtn
            active={tab === "all"}
            label="All"
            count={applications.length}
            onClick={() => setTab("all")}
          />
          <TabBtn
            active={tab === "pending"}
            label="Pending"
            count={pending.length}
            onClick={() => setTab("pending")}
          />
          <TabBtn
            active={tab === "accepted"}
            label="Accepted"
            count={accepted.length}
            onClick={() => setTab("accepted")}
          />
          <TabBtn
            active={tab === "rejected"}
            label="Rejected"
            count={rejected.length}
            onClick={() => setTab("rejected")}
          />
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <FiUsers className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground text-sm">
                {tab === "all"
                  ? "No applications yet."
                  : `No ${tab} applications.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((app) => {
              const workerName = app.worker
                ? [app.worker.firstName, app.worker.lastName]
                    .filter(Boolean)
                    .join(" ") || app.worker.email
                : app.workerFirebaseUid;

              return (
                <Card key={app.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        {app.worker?.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={app.worker.photoUrl}
                            alt={workerName}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full object-cover border shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                            {workerName[0]?.toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {workerName}
                          </p>
                          {app.worker?.email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {app.worker.email}
                            </p>
                          )}
                          {app.message && (
                            <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-1">
                              &quot;{app.message}&quot;
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {app.status === "accepted" ? (
                              <Badge className="bg-primary text-white border-0 gap-1 text-[10px]">
                                <FiCheckCircle className="h-2.5 w-2.5" />{" "}
                                Accepted
                              </Badge>
                            ) : app.status === "rejected" ? (
                              <Badge
                                variant="destructive"
                                className="gap-1 text-[10px]"
                              >
                                <FiXCircle className="h-2.5 w-2.5" /> Rejected
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="gap-1 text-[10px]"
                              >
                                <FiClock className="h-2.5 w-2.5" /> Pending
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              Applied{" "}
                              {new Date(app.appliedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() =>
                            setViewingUid(
                              viewingUid === app.workerFirebaseUid
                                ? null
                                : app.workerFirebaseUid
                            )
                          }
                        >
                          <FiUser className="h-3 w-3" />
                          {viewingUid === app.workerFirebaseUid
                            ? "Hide"
                            : "Profile"}
                        </Button>
                        {app.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              className="gap-1 text-xs"
                              disabled={updating === app.id}
                              onClick={() =>
                                handleStatusChange(app.id, "accepted")
                              }
                            >
                              <FiCheck className="h-3 w-3" /> Accept
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1 text-xs"
                              disabled={updating === app.id}
                              onClick={() =>
                                handleStatusChange(app.id, "rejected")
                              }
                            >
                              <FiX className="h-3 w-3" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline worker profile */}
                    <AnimatePresence>
                      {viewingUid === app.workerFirebaseUid && (
                        <div className="mt-4">
                          <WorkerProfilePanel
                            uid={app.workerFirebaseUid}
                            token={token!}
                            onClose={() => setViewingUid(null)}
                          />
                        </div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
