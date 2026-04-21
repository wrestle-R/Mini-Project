"use client";

import { useState, useEffect, useCallback } from "react";
import { useContractor } from "@/contexts/ContractorContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FiFolder,
  FiMapPin,
  FiUser,
  FiPhone,
  FiMail,
  FiChevronRight,
} from "react-icons/fi";

interface Assignment {
  id: string;
  project:
    | {
        _id?: string;
        title: string;
        status: string;
        location: { displayName: string; lat: number | null; lng: number | null };
      }
    | null;
  customer: { name: string; email: string; phone: string } | null;
  contractor: { firstName: string; lastName: string; email: string } | null;
  status: string;
  notes: string;
  assignedAt: string;
}

export function ContractorProjects() {
  const { token } = useContractor();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch {
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
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
        <h1 className="text-2xl font-bold tracking-tight">My Projects</h1>
        <p className="text-muted-foreground">
          Projects assigned to you. Click on a project to view details and worker applications.
        </p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FiFolder className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">
              No projects assigned yet
            </p>
            <p className="text-sm text-muted-foreground/70">
              Your company will assign projects to you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assignments.map((a) => {
            // Extract project ID from populated object or string
            const projectId =
              (a.project as unknown as { _id?: string })?._id ||
              (typeof a.project === "string" ? a.project : null);

            return (
              <Card
                key={a.id}
                className="cursor-pointer transition-shadow hover:shadow-md group"
                onClick={() => {
                  if (projectId) {
                    router.push(`/contractor/projects/${a.id}`);
                  }
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {a.project?.title || "Untitled Project"}
                      </CardTitle>
                      <CardDescription>
                        Assigned {new Date(a.assignedAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{a.project?.status || "—"}</Badge>
                      <Badge variant="secondary">{a.status}</Badge>
                      <FiChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {a.project?.location && (
                      <span className="flex items-center gap-1">
                        <FiMapPin className="h-3.5 w-3.5" />
                        {a.project.location.displayName || "Location pending"}
                      </span>
                    )}
                  </div>

                  {a.customer && (
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                        Customer
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <FiUser className="h-3.5 w-3.5" /> {a.customer.name}
                        </span>
                        {a.customer.email && (
                          <span className="flex items-center gap-1">
                            <FiMail className="h-3.5 w-3.5" /> {a.customer.email}
                          </span>
                        )}
                        {a.customer.phone && (
                          <span className="flex items-center gap-1">
                            <FiPhone className="h-3.5 w-3.5" /> {a.customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {a.notes && (
                    <p className="text-sm text-muted-foreground italic">
                      {a.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
