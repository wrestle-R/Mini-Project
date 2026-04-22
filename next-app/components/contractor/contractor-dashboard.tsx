"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useContractor } from "@/contexts/ContractorContext";
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
import { FiFolder, FiClock, FiUsers, FiArchive } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const LeafletMap = dynamic(() => import("@/components/shared/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] w-full rounded-xl border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
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

type Stats = {
  activeAssignments: number;
  pendingApplications: number;
  acceptedWorkers: number;
  pastProjects: number;
};

const defaultStats: Stats = {
  activeAssignments: 0,
  pendingApplications: 0,
  acceptedWorkers: 0,
  pastProjects: 0,
};

const statCards = [
  { key: "activeAssignments", label: "Active Assignments", icon: FiFolder },
  { key: "pendingApplications", label: "Pending Applications", icon: FiClock },
  { key: "acceptedWorkers", label: "Accepted Workers", icon: FiUsers },
  { key: "pastProjects", label: "Past Projects", icon: FiArchive },
] as const;

export function ContractorDashboard() {
  const { user, token } = useContractor();
  const firstName = user.firstName;
  const lastName = user.lastName;
  const id = user.id;

  const [stats, setStats] = useState<Stats>(defaultStats);
  const [mapProjects, setMapProjects] = useState<MapProject[]>([]);
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");
  const [attendanceStats, setAttendanceStats] = useState({
    total: 0,
    success: 0,
    failure: 0,
    ppeViolations: 0,
  });
  const [attendanceRecords, setAttendanceRecords] = useState<
    Array<{
      id: string;
      name: string;
      status: string;
      reason: string;
      source: string;
      score: number;
      time: string;
      ppe: { hard_hat: boolean; vest: boolean; compliant: boolean } | null;
      frameUrl: string;
    }>
  >([]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!token) return;
      try {
        const res = await fetch("/api/dashboard/contractor/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load stats");
        const data = await res.json();
        setStats({
          activeAssignments: Number(data?.stats?.activeAssignments ?? 0),
          pendingApplications: Number(data?.stats?.pendingApplications ?? 0),
          acceptedWorkers: Number(data?.stats?.acceptedWorkers ?? 0),
          pastProjects: Number(data?.stats?.pastProjects ?? 0),
        });
        setMapProjects((data?.mapProjects || []) as MapProject[]);

        const attendanceRes = await fetch("/api/dashboard/contractor/attendance", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (attendanceRes.ok) {
          const attendanceData = await attendanceRes.json();
          setAttendanceStats(
            attendanceData?.stats || {
              total: 0,
              success: 0,
              failure: 0,
              ppeViolations: 0,
            }
          );
          setAttendanceRecords((attendanceData?.records || []).slice(0, 8));
        }
      } catch {
        toast.error("Failed to load dashboard stats");
      }
    };

    fetchStats();
  }, [token]);

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Contractor";

  const markerProjects = mapProjects.filter(
    (project) =>
      typeof project.location?.lat === "number" &&
      typeof project.location?.lng === "number"
  );

  if (!id) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[360px] w-full rounded-xl" />
      </div>
    );
  }

  const currentCount = mapProjects.filter((p) => p.timeline === "current").length;
  const pastCount = mapProjects.filter((p) => p.timeline === "past").length;
  const completedCount = mapProjects.filter((p) => p.status === "completed").length;

  const filteredProjects = markerProjects.filter((project) => {
    if (mapFilter === "current") return project.timeline === "current";
    if (mapFilter === "past") return project.timeline === "past";
    if (mapFilter === "completed") return project.status === "completed";
    return true;
  });

  const mapCenter = filteredProjects[0] || markerProjects[0]
    ? {
        lat: (filteredProjects[0] || markerProjects[0]).location.lat as number,
        lng: (filteredProjects[0] || markerProjects[0]).location.lng as number,
      }
    : { lat: 20.5937, lng: 78.9629 };

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
              <Badge variant="secondary">Contractor</Badge>
            </div>
            <CardDescription>
              Track assignment health and site coverage in one view.
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
                Only your assigned projects are shown with current and past status.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Current {currentCount}</Badge>
              <Badge variant="outline">Past {pastCount}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
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
            lat={mapCenter.lat}
            lng={mapCenter.lng}
            zoom={filteredProjects.length > 0 ? 6 : 5}
            scrollWheelZoom
            className="h-[360px] w-full overflow-hidden rounded-xl border"
            markers={filteredProjects.map((project) => ({
              id: project.id,
              lat: project.location.lat as number,
              lng: project.location.lng as number,
              popup: `${project.title} (${project.status})`,
              color: markerColorForStatus(project.status),
            }))}
          />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {mapProjects.slice(0, 6).map((project) => (
              <div
                key={project.id}
                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
              >
                <p className="text-sm font-medium truncate">{project.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {project.location.displayName || "Location pending"}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {project.status}
                  </Badge>
                  <Badge
                    variant={project.timeline === "current" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {project.timeline}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Monitoring</CardTitle>
          <CardDescription>
            Live attendance and PPE compliance from IoT camera frames.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-semibold">{attendanceStats.total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Present</p>
              <p className="text-xl font-semibold text-emerald-600">{attendanceStats.success}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Failures</p>
              <p className="text-xl font-semibold text-destructive">{attendanceStats.failure}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">PPE Violations</p>
              <p className="text-xl font-semibold text-amber-600">{attendanceStats.ppeViolations}</p>
            </div>
          </div>

          <div className="space-y-2">
            {attendanceRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance events yet.</p>
            ) : (
              attendanceRecords.map((row) => (
                <div key={row.id} className="rounded-lg border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    {row.frameUrl ? (
                      <div className="h-12 w-16 overflow-hidden rounded-md border bg-muted/40 relative">
                        <Image src={row.frameUrl} alt="Frame" fill className="object-cover" unoptimized />
                      </div>
                    ) : null}
                    <div>
                      <p className="text-sm font-medium">{row.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.time).toLocaleString("en-IN")} • {row.source}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs flex items-center gap-2">
                    <Badge variant={row.status === "success" ? "secondary" : "outline"}>{row.status}</Badge>
                    {row.ppe && (
                      <Badge variant={row.ppe.compliant ? "secondary" : "outline"}>
                        PPE {row.ppe.compliant ? "OK" : "Issue"}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">{(row.score * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
