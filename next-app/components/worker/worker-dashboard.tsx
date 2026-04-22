"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useWorker } from "@/contexts/WorkerContext";
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
import { toast } from "sonner";
import { FiBriefcase, FiClock, FiCheckCircle, FiMapPin } from "react-icons/fi";

const LeafletMap = dynamic(() => import("@/components/shared/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] w-full rounded-xl border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
      Loading map...
    </div>
  ),
});

type ProjectLocation = {
  displayName: string;
  lat: number | null;
  lng: number | null;
};

type MapProject = {
  id: string;
  title: string;
  status: string;
  timeline: "current" | "past";
  location: ProjectLocation;
};

type MapFilter = "all" | "current" | "past" | "completed";

type WorkerStats = {
  openOpportunities: number;
  pendingApplications: number;
  acceptedProjects: number;
  currentAssignments: number;
};

const defaultStats: WorkerStats = {
  openOpportunities: 0,
  pendingApplications: 0,
  acceptedProjects: 0,
  currentAssignments: 0,
};

const statCards = [
  { key: "openOpportunities", label: "Open Opportunities", icon: FiBriefcase },
  { key: "pendingApplications", label: "Pending Applications", icon: FiClock },
  { key: "acceptedProjects", label: "Accepted Projects", icon: FiCheckCircle },
  { key: "currentAssignments", label: "Current Assignments", icon: FiMapPin },
] as const;

export function WorkerDashboard() {
  const { user, firebaseUser } = useWorker();
  const { firstName, lastName, firebaseUid } = user;

  const [stats, setStats] = useState<WorkerStats>(defaultStats);
  const [mapProjects, setMapProjects] = useState<MapProject[]>([]);
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!firebaseUser) return;
      try {
        const idToken = await firebaseUser.getIdToken();

        const statsRes = await fetch("/api/dashboard/worker/stats", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!statsRes.ok) throw new Error("Failed to load dashboard stats");

        const statsData = await statsRes.json();

        setStats({
          openOpportunities: Number(statsData?.stats?.openOpportunities ?? 0),
          pendingApplications: Number(statsData?.stats?.pendingApplications ?? 0),
          acceptedProjects: Number(statsData?.stats?.acceptedProjects ?? 0),
          currentAssignments: Number(statsData?.stats?.currentAssignments ?? 0),
        });

        setMapProjects((statsData?.mapProjects || []) as MapProject[]);
      } catch {
        toast.error("Failed to load worker dashboard");
      }
    };

    fetchDashboardData();
  }, [firebaseUser]);

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Worker";

  const markerProjects = mapProjects.filter(
    (project) =>
      typeof project.location?.lat === "number" &&
      typeof project.location?.lng === "number"
  );

  if (!firebaseUid) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[340px] w-full rounded-xl" />
      </div>
    );
  }

  const mapCenter = markerProjects[0]
    ? {
        lat: markerProjects[0].location.lat as number,
        lng: markerProjects[0].location.lng as number,
      }
    : { lat: 20.5937, lng: 78.9629 };

  const currentCount = mapProjects.filter((p) => p.timeline === "current").length;
  const pastCount = mapProjects.filter((p) => p.timeline === "past").length;
  const completedCount = mapProjects.filter((p) => p.status === "completed").length;

  const filteredProjects = markerProjects.filter((project) => {
    if (mapFilter === "current") return project.timeline === "current";
    if (mapFilter === "past") return project.timeline === "past";
    if (mapFilter === "completed") return project.status === "completed";
    return true;
  });

  const mapFocus = filteredProjects[0] || markerProjects[0];

  const dynamicCenter = mapFocus
    ? {
        lat: mapFocus.location.lat as number,
        lng: mapFocus.location.lng as number,
      }
    : mapCenter;

  const markerColorForStatus = (status: string) => {
    if (status === "completed") return "#16a34a";
    if (status === "cancelled") return "#dc2626";
    if (status === "on-hold") return "#f59e0b";
    if (status === "active") return "#0ea5e9";
    return "#2563eb";
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card className="overflow-hidden border-border/70">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">
                Welcome back, {displayName}
              </CardTitle>
              <Badge variant="secondary">Worker</Badge>
            </div>
            <CardDescription>
              View your opportunities, accepted assignments, and site map.
            </CardDescription>
          </CardHeader>
        </Card>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 * idx }}
          >
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-lg bg-primary/10 p-3">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {stats[stat.key].toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="overflow-hidden border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Assigned Projects Map</CardTitle>
              <CardDescription>
                Only projects assigned to you are shown on this map.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Current {currentCount}</Badge>
              <Badge variant="outline">Past {pastCount}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={mapFilter === "all" ? "default" : "outline"}
              onClick={() => setMapFilter("all")}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={mapFilter === "current" ? "default" : "outline"}
              onClick={() => setMapFilter("current")}
            >
              Current
            </Button>
            <Button
              size="sm"
              variant={mapFilter === "past" ? "default" : "outline"}
              onClick={() => setMapFilter("past")}
            >
              Past
            </Button>
            <Button
              size="sm"
              variant={mapFilter === "completed" ? "default" : "outline"}
              onClick={() => setMapFilter("completed")}
            >
              Completed
            </Button>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span>All {markerProjects.length}</span>
              <span>Current {currentCount}</span>
              <span>Past {pastCount}</span>
              <span>Completed {completedCount}</span>
            </div>
          </div>

          <LeafletMap
            lat={dynamicCenter.lat}
            lng={dynamicCenter.lng}
            zoom={filteredProjects.length > 0 ? 6 : 5}
            scrollWheelZoom
            className="h-[340px] w-full overflow-hidden rounded-xl border"
            markers={filteredProjects.map((project) => ({
              id: project.id,
              lat: project.location.lat as number,
              lng: project.location.lng as number,
              popup: `${project.title} (${project.status})`,
              color: markerColorForStatus(project.status),
            }))}
          />
        </CardContent>
      </Card>

    </div>
  );
}
