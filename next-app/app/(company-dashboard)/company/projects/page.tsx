"use client";

import { useState, useEffect, useCallback } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LocationPicker, type LocationValue } from "@/components/shared/location-picker";
import { toast } from "sonner";
import { FiPlus, FiFolder, FiMapPin, FiCrosshair } from "react-icons/fi";

interface ProjectLocation {
  displayName: string;
  lat: number | null;
  lng: number | null;
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  location: ProjectLocation;
  budget: number;
  isOpen: boolean;
  createdAt: string;
}

type ProjectForm = {
  title: string;
  description: string;
  location: ProjectLocation;
  budget: string;
};

const DEFAULT_FORM: ProjectForm = {
  title: "",
  description: "",
  location: {
    displayName: "",
    lat: null,
    lng: null,
  },
  budget: "",
};

function parseCoordinateInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function CompanyProjectsPage() {
  const { token } = useCompany();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ProjectForm>(DEFAULT_FORM);

  const fetchProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!token || !form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          location: form.location,
          budget: form.budget ? Number(form.budget) : 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      toast.success("Project created!");
      setForm(DEFAULT_FORM);
      setShowForm(false);
      fetchProjects();
    } catch {
      toast.error("Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLocationChange = (location: LocationValue) => {
    setForm((prev) => ({
      ...prev,
      location: {
        displayName: location.displayName,
        lat: location.lat,
        lng: location.lng,
      },
    }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <FiPlus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
              <CardTitle>Create Project</CardTitle>
              <CardDescription>
                Add a new project with precise geo coordinates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Project title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Brief description"
                />
              </div>

              <div className="space-y-2">
                <Label>Project Location</Label>
                <div className="rounded-xl border border-border/70 bg-card p-3">
                  <LocationPicker
                    value={{
                      displayName: form.location.displayName,
                      lat: form.location.lat ?? undefined,
                      lng: form.location.lng ?? undefined,
                    }}
                    onChange={handleLocationChange}
                    label=""
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    inputMode="decimal"
                    value={form.location.lat ?? ""}
                    onChange={(e) => {
                      const lat = parseCoordinateInput(e.target.value);
                      setForm((f) => ({
                        ...f,
                        location: {
                          ...f.location,
                          lat,
                        },
                      }));
                    }}
                    placeholder="e.g. 19.076"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    inputMode="decimal"
                    value={form.location.lng ?? ""}
                    onChange={(e) => {
                      const lng = parseCoordinateInput(e.target.value);
                      setForm((f) => ({
                        ...f,
                        location: {
                          ...f.location,
                          lng,
                        },
                      }));
                    }}
                    placeholder="e.g. 72.8777"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={form.budget}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, budget: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-1">
                  <FiCrosshair className="h-3.5 w-3.5" />
                  Save either picked or manually entered coordinates.
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? "Creating..." : "Create"}
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FiFolder className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No projects yet. Create your first project.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <h3 className="font-semibold">{project.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {project.description || "No description"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {(project.location.displayName ||
                        project.location.lat !== null ||
                        project.location.lng !== null) && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <FiMapPin className="h-3.5 w-3.5" />
                          {project.location.displayName || "Pinned location"}
                          {project.location.lat !== null &&
                            project.location.lng !== null &&
                            ` (${project.location.lat.toFixed(5)}, ${project.location.lng.toFixed(5)})`}
                        </span>
                      )}
                      {project.budget > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Budget: INR {project.budget.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={project.isOpen ? "default" : "secondary"}>
                      {project.isOpen ? "Open" : "Closed"}
                    </Badge>
                    <Badge variant="outline">{project.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
