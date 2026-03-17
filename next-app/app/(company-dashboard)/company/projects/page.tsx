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
import { toast } from "sonner";
import { FiPlus, FiFolder } from "react-icons/fi";

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string;
  budget: number;
  isOpen: boolean;
  createdAt: string;
}

export default function CompanyProjectsPage() {
  const { token } = useCompany();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    budget: "",
  });

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
          ...form,
          budget: form.budget ? Number(form.budget) : 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      toast.success("Project created!");
      setForm({ title: "", description: "", location: "", budget: "" });
      setShowForm(false);
      fetchProjects();
    } catch {
      toast.error("Failed to create project");
    } finally {
      setSubmitting(false);
    }
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
          <Card>
            <CardHeader>
              <CardTitle>Create Project</CardTitle>
              <CardDescription>Add a new project to your company</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, location: e.target.value }))
                    }
                    placeholder="City, State"
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
            <FiFolder className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No projects yet. Create your first project.</p>
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
                    <div className="flex items-center gap-2 mt-2">
                      {project.location && (
                        <span className="text-xs text-muted-foreground">
                          {project.location}
                        </span>
                      )}
                      {project.budget > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Budget: ₹{project.budget.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={project.isOpen ? "default" : "secondary"}
                    >
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
