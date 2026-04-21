"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorker } from "@/contexts/WorkerContext";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FiFolder,
  FiMapPin,
  FiDollarSign,
  FiCalendar,
  FiSend,
  FiCheckCircle,
  FiClock,
  FiXCircle,
} from "react-icons/fi";

/* ─────────────────── Types ─────────────────── */

type Tab = "available" | "applied" | "ongoing";

interface ProjectItem {
  id: string;
  title: string;
  description: string;
  status: string;
  location: { displayName: string; lat: number | null; lng: number | null };
  budget: number;
  isOpen: boolean;
  startDate: string | null;
  endDate: string | null;
  company: { name: string; sector: string } | null;
  applicationStatus: "pending" | "accepted" | "rejected" | null;
  appliedAt: string | null;
  createdAt: string;
}

/* ─────────────────── Tab Button ─────────────────── */

function TabButton({
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
      className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`ml-2 inline-flex items-center justify-center text-xs rounded-full px-1.5 py-0.5 ${
            active
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted-foreground/20 text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ─────────────────── Application Status Badge ─────────────────── */

function AppStatusBadge({ status }: { status: string }) {
  if (status === "accepted")
    return (
      <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400">
        <FiCheckCircle className="h-3 w-3 mr-1" /> Accepted
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive" className="gap-1">
        <FiXCircle className="h-3 w-3" /> Rejected
      </Badge>
    );
  return (
    <Badge variant="secondary" className="gap-1">
      <FiClock className="h-3 w-3" /> Pending
    </Badge>
  );
}

/* ─────────────────── Main Component ─────────────────── */

export function WorkerProjects() {
  const { firebaseUser } = useWorker();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("available");
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const fetchProjects = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/worker/projects", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleApply = async (projectId: string) => {
    if (!firebaseUser) return;
    setApplyingTo(projectId);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/worker/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ projectId, message }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to apply");
      }
      toast.success("Application submitted!");
      setMessage("");
      fetchProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply";
      toast.error(msg);
    } finally {
      setApplyingTo(null);
    }
  };

  // ── Categorize ──
  const available = projects.filter(
    (p) => p.isOpen && !p.applicationStatus
  );
  const applied = projects.filter(
    (p) => p.applicationStatus === "pending" || p.applicationStatus === "rejected"
  );
  const ongoing = projects.filter(
    (p) => p.applicationStatus === "accepted"
  );

  const current =
    tab === "available" ? available : tab === "applied" ? applied : ongoing;

  const tabHeadings: Record<Tab, { title: string; desc: string }> = {
    available: {
      title: "Available Projects",
      desc: "Browse open projects and submit your applications.",
    },
    applied: {
      title: "My Applications",
      desc: "Projects you've applied to and their status.",
    },
    ongoing: {
      title: "Ongoing Projects",
      desc: "Projects where your application was accepted.",
    },
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 w-fit">
        <TabButton
          active={tab === "available"}
          label="Available"
          count={available.length}
          onClick={() => setTab("available")}
        />
        <TabButton
          active={tab === "applied"}
          label="Applied"
          count={applied.length}
          onClick={() => setTab("applied")}
        />
        <TabButton
          active={tab === "ongoing"}
          label="Ongoing"
          count={ongoing.length}
          onClick={() => setTab("ongoing")}
        />
      </div>

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {tabHeadings[tab].title}
        </h1>
        <p className="text-muted-foreground">{tabHeadings[tab].desc}</p>
      </div>

      {/* Projects list */}
      {current.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FiFolder className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">
              {tab === "available"
                ? "No open projects right now"
                : tab === "applied"
                ? "You haven't applied to any projects yet"
                : "No ongoing projects"}
            </p>
            <p className="text-sm text-muted-foreground/70">
              {tab === "available"
                ? "Check back later for new opportunities."
                : tab === "applied"
                ? "Browse available projects to get started."
                : "Once your applications are accepted, they'll appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {current.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.title}</CardTitle>
                    {project.company && (
                      <CardDescription>
                        {project.company.name}
                        {project.company.sector &&
                          ` · ${project.company.sector}`}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{project.status}</Badge>
                    {project.applicationStatus && (
                      <AppStatusBadge status={project.applicationStatus} />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.description && (
                  <p className="text-sm text-muted-foreground">
                    {project.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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
                        ` – ${new Date(
                          project.endDate
                        ).toLocaleDateString()}`}
                    </span>
                  )}
                  {project.appliedAt && (
                    <span className="flex items-center gap-1">
                      <FiClock className="h-3.5 w-3.5" /> Applied{" "}
                      {new Date(project.appliedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Apply button for available tab only */}
                {tab === "available" && !project.applicationStatus && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Optional message with your application..."
                      value={applyingTo === project.id ? message : ""}
                      onChange={(e) => {
                        setApplyingTo(project.id);
                        setMessage(e.target.value);
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleApply(project.id)}
                      disabled={applyingTo === project.id && !message && applyingTo !== null}
                    >
                      <FiSend className="h-4 w-4 mr-2" />
                      {applyingTo === project.id ? "Applying..." : "Apply"}
                    </Button>
                  </div>
                )}

                {/* Already applied badge in available tab */}
                {tab === "available" && project.applicationStatus && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                    <FiCheckCircle className="h-4 w-4" /> Already applied
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
