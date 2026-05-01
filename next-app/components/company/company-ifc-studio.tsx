"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FiBox, FiClock, FiLayers } from "react-icons/fi";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[500px] items-center justify-center text-muted-foreground">
      Loading viewer
    </div>
  ),
});

interface SessionSummary {
  id: string;
  title: string;
  sourceFileName: string;
  currentGlbUrl: string;
  currentMetadataUrl: string;
  currentVersionNumber?: number;
  versionCount: number;
  workflowState?: string;
  updatedAt: string;
}

export function CompanyIfcStudio() {
  const { token } = useCompany();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/company/ifc/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load IFC sessions");
      const data = await res.json();
      const nextSessions = (data.sessions || []) as SessionSummary[];
      setSessions(nextSessions);
      setActiveSession((current) =>
        current
          ? nextSessions.find((session) => session.id === current.id) || nextSessions[0] || null
          : nextSessions[0] || null
      );
    } catch {
      toast.error("Could not load company IFC sessions");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IFC Studio</h1>
        <p className="text-muted-foreground">
          Review IFC sessions uploaded by contractors under your company.
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FiBox className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground">No IFC sessions yet</p>
            <p className="text-sm text-muted-foreground/70">
              Contractor IFC uploads will appear here for review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FiLayers className="h-4 w-4" />
                Sessions
              </CardTitle>
              <CardDescription>Read-only company access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessions.map((session) => (
                <Button
                  key={session.id}
                  type="button"
                  variant={activeSession?.id === session.id ? "secondary" : "ghost"}
                  className="h-auto w-full justify-start p-3 text-left"
                  onClick={() => setActiveSession(session)}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{session.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {session.sourceFileName}
                    </p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>{activeSession?.title || "IFC model"}</CardTitle>
                  <CardDescription>
                    Updated{" "}
                    {activeSession?.updatedAt
                      ? new Date(activeSession.updatedAt).toLocaleString()
                      : "—"}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    v{activeSession?.currentVersionNumber || 0}
                  </Badge>
                  <Badge variant="outline">
                    <FiClock className="h-3 w-3" />
                    {activeSession?.workflowState || "draft"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeSession && (
                <div className="min-h-[560px] rounded-xl border bg-muted/20">
                  <ModelViewer
                    modelUrl={activeSession.currentGlbUrl}
                    metadataUrl={activeSession.currentMetadataUrl}
                    authToken={token}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
