"use client";

import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FiPlus, FiClipboard } from "react-icons/fi";

interface AssignmentItem {
  id: string;
  project: { _id: string; title: string; status: string } | null;
  contractor: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  customer: { _id: string; name: string; email: string } | null;
  status: string;
  notes: string;
  assignedAt: string;
}

interface SelectOption {
  id: string;
  label: string;
}

export default function CompanyAssignmentsPage() {
  const { token } = useCompany();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [projects, setProjects] = useState<SelectOption[]>([]);
  const [contractors, setContractors] = useState<SelectOption[]>([]);
  const [customers, setCustomers] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    projectId: "",
    contractorId: "",
    customerId: "",
    notes: "",
  });

  const fetchAll = async () => {
    if (!token) return;
    try {
      const [aRes, pRes, cRes, cuRes] = await Promise.all([
        fetch("/api/assignments", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/projects", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/contractors", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/customers", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (aRes.ok) {
        const data = await aRes.json();
        setAssignments(data.assignments);
      }
      if (pRes.ok) {
        const data = await pRes.json();
        setProjects(
          data.projects.map((p: { id: string; title: string }) => ({
            id: p.id,
            label: p.title,
          }))
        );
      }
      if (cRes.ok) {
        const data = await cRes.json();
        setContractors(
          data.contractors.map(
            (c: { id: string; firstName: string; lastName: string; email: string }) => ({
              id: c.id,
              label:
                [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email,
            })
          )
        );
      }
      if (cuRes.ok) {
        const data = await cuRes.json();
        setCustomers(
          data.customers.map((c: { id: string; name: string }) => ({
            id: c.id,
            label: c.name,
          }))
        );
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [token]);

  const handleCreate = async () => {
    if (!token || !form.projectId || !form.contractorId) {
      toast.error("Project and Contractor are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to create");
      toast.success("Assignment created!");
      setForm({ projectId: "", contractorId: "", customerId: "", notes: "" });
      setShowForm(false);
      fetchAll();
    } catch {
      toast.error("Failed to create assignment");
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
        <h1 className="text-2xl font-bold">Assignments</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <FiPlus className="mr-2 h-4 w-4" />
          New Assignment
        </Button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Assign Contractor to Project</CardTitle>
              <CardDescription>
                Assign a contractor and optionally a customer to a project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectId">Project *</Label>
                <select
                  id="projectId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.projectId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, projectId: e.target.value }))
                  }
                >
                  <option value="">Select a project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractorId">Contractor *</Label>
                <select
                  id="contractorId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.contractorId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contractorId: e.target.value }))
                  }
                >
                  <option value="">Select a contractor</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerId">Customer (optional)</Label>
                <select
                  id="customerId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.customerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerId: e.target.value }))
                  }
                >
                  <option value="">None</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-notes">Notes</Label>
                <Input
                  id="assign-notes"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? "Assigning..." : "Assign"}
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FiClipboard className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No assignments yet. Assign contractors to projects.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <h3 className="font-semibold">
                      {a.project?.title || "Unknown Project"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Contractor:{" "}
                      {a.contractor
                        ? [a.contractor.firstName, a.contractor.lastName]
                            .filter(Boolean)
                            .join(" ") || a.contractor.email
                        : "Unknown"}
                    </p>
                    {a.customer && (
                      <p className="text-sm text-muted-foreground">
                        Customer: {a.customer.name}
                      </p>
                    )}
                    {a.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.notes}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">{a.status}</Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
