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
} from "react-icons/fi";

interface ProjectItem {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string;
  budget: number;
  startDate: string | null;
  endDate: string | null;
  company: { name: string; sector: string } | null;
  hasApplied: boolean;
  createdAt: string;
}

export function WorkerProjects() {
  const { firebaseUser } = useWorker();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <div className="space-y-4">
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Open Projects</h1>
        <p className="text-muted-foreground">
          Browse available projects and submit your applications.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FiFolder className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">
              No open projects right now
            </p>
            <p className="text-sm text-muted-foreground/70">
              Check back later for new opportunities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
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
                  <Badge variant="outline">{project.status}</Badge>
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
                      <FiMapPin className="h-3.5 w-3.5" /> {project.location}
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

                {project.hasApplied ? (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                    <FiCheckCircle className="h-4 w-4" /> Applied
                  </div>
                ) : (
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
