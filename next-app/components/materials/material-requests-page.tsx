"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useWorker } from "@/contexts/WorkerContext";
import { useContractor } from "@/contexts/ContractorContext";
import { useCompany } from "@/contexts/CompanyContext";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FiCheckCircle,
  FiClock,
  FiPackage,
  FiPlus,
  FiSend,
  FiTool,
  FiXCircle,
} from "react-icons/fi";

type Role = "worker" | "contractor" | "company";

type ProjectOption = {
  id: string;
  title: string;
  status: string;
};

type MaterialStatus = "pending" | "approved" | "rejected" | "fulfilled";

type MaterialRequest = {
  id: string;
  project: ProjectOption | null;
  requestedByRole: "worker" | "contractor";
  requesterName: string;
  materialName: string;
  quantity: number;
  unit: string;
  urgency: "low" | "normal" | "high";
  reason: string;
  status: MaterialStatus;
  companyNote: string;
  createdAt: string;
};

type MaterialForm = {
  projectId: string;
  materialName: string;
  quantity: string;
  unit: string;
  urgency: "low" | "normal" | "high";
  reason: string;
};

const DEFAULT_FORM: MaterialForm = {
  projectId: "",
  materialName: "",
  quantity: "",
  unit: "pcs",
  urgency: "normal",
  reason: "",
};

const STATUS_META: Record<
  MaterialStatus,
  { label: string; className: string; icon: typeof FiClock }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300",
    icon: FiClock,
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300",
    icon: FiCheckCircle,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300",
    icon: FiXCircle,
  },
  fulfilled: {
    label: "Fulfilled",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300",
    icon: FiPackage,
  },
};

function StatusBadge({ status }: { status: MaterialStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={meta.className}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function urgencyClass(urgency: MaterialRequest["urgency"]) {
  if (urgency === "high") return "border-red-200 text-red-700 dark:border-red-900 dark:text-red-300";
  if (urgency === "low") return "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300";
  return "border-primary/20 text-primary";
}

export function MaterialRequestsPage({ role }: { role: Role }) {
  const { firebaseUser } = useWorker();
  const { token: contractorToken } = useContractor();
  const { token: companyToken } = useCompany();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(role !== "company");
  const [requesterFilter, setRequesterFilter] = useState<
    "all" | "worker" | "contractor"
  >("all");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [companyNotes, setCompanyNotes] = useState<Record<string, string>>({});
  const [form, setForm] = useState<MaterialForm>(DEFAULT_FORM);

  const canCreate = role !== "company";

  const getAuthHeader = useCallback(async () => {
    if (role === "worker") {
      const token = await firebaseUser?.getIdToken();
      return token ? `Bearer ${token}` : null;
    }
    const token = role === "contractor" ? contractorToken : companyToken;
    return token ? `Bearer ${token}` : null;
  }, [companyToken, contractorToken, firebaseUser, role]);

  const fetchRequests = useCallback(async () => {
    const auth = await getAuthHeader();
    if (!auth) return;
    try {
      const res = await fetch("/api/material-requests", {
        headers: { Authorization: auth },
      });
      if (!res.ok) throw new Error("Failed to load material requests");
      const data = await res.json();
      const nextRequests = data.requests || [];
      setRequests(nextRequests);
      setProjects(data.projects || []);
      setCompanyNotes(
        Object.fromEntries(
          nextRequests.map((request: MaterialRequest) => [
            request.id,
            request.companyNote || "",
          ])
        )
      );
    } catch {
      toast.error("Failed to load material requests");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (role === "company") {
      setShowForm(false);
    }
  }, [role]);

  useEffect(() => {
    if (!form.projectId && projects.length > 0) {
      setForm((prev) => ({ ...prev, projectId: projects[0].id }));
    }
  }, [form.projectId, projects]);

  const counts = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === "pending").length,
      approved: requests.filter((request) => request.status === "approved").length,
      fulfilled: requests.filter((request) => request.status === "fulfilled").length,
      worker: requests.filter((request) => request.requestedByRole === "worker").length,
      contractor: requests.filter((request) => request.requestedByRole === "contractor")
        .length,
    }),
    [requests]
  );

  const visibleRequests = useMemo(() => {
    if (role !== "company" || requesterFilter === "all") return requests;
    return requests.filter((request) => request.requestedByRole === requesterFilter);
  }, [requesterFilter, requests, role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const auth = await getAuthHeader();
    if (!auth) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/material-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to submit request");
      toast.success("Material request sent");
      setForm((prev) => ({ ...DEFAULT_FORM, projectId: prev.projectId }));
      fetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (requestId: string, status: MaterialStatus) => {
    const auth = await getAuthHeader();
    if (!auth) return;
    setUpdatingId(requestId);
    try {
      const res = await fetch("/api/material-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
        body: JSON.stringify({
          requestId,
          status,
          companyNote: companyNotes[requestId] || "",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to update request");
      toast.success("Request updated");
      fetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update request");
    } finally {
      setUpdatingId(null);
    }
  };

  const heading =
    role === "company"
      ? "Material Requests"
      : role === "contractor"
        ? "Project Materials"
        : "My Material Requests";

  const description =
    role === "company"
      ? "Review requests from workers and contractors across your projects."
      : "Request site materials for active project work and track company decisions.";

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        {canCreate && (
          <Button
            type="button"
            variant={showForm ? "secondary" : "default"}
            onClick={() => setShowForm((value) => !value)}
          >
            <FiPlus className="h-4 w-4" />
            {showForm ? "Hide Form" : "New Request"}
          </Button>
        )}
      </div>

      {role === "company" && (
        <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/20 p-1 w-fit">
          {[
            { value: "all", label: "All", count: requests.length },
            { value: "worker", label: "Workers", count: counts.worker },
            { value: "contractor", label: "Contractors", count: counts.contractor },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                setRequesterFilter(item.value as "all" | "worker" | "contractor")
              }
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                requesterFilter === item.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              <span className="ml-2 text-xs text-muted-foreground">{item.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <FiClock className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-semibold">{counts.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <FiCheckCircle className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-semibold">{counts.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <FiPackage className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-semibold">{counts.fulfilled}</p>
              <p className="text-xs text-muted-foreground">Fulfilled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {canCreate && showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FiTool className="h-4 w-4" />
              Request Materials
            </CardTitle>
            <CardDescription>
              Send the company a clear material requirement with the project and reason.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No eligible projects found for material requests.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="projectId">Project</Label>
                  <select
                    id="projectId"
                    name="projectId"
                    value={form.projectId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, projectId: event.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materialName">Material</Label>
                  <Input
                    id="materialName"
                    name="materialName"
                    value={form.materialName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, materialName: event.target.value }))
                    }
                    placeholder="Cement bags"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="grid grid-cols-[1fr_120px] gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.quantity}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, quantity: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      name="unit"
                      value={form.unit}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, unit: event.target.value }))
                      }
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgency</Label>
                  <select
                    id="urgency"
                    name="urgency"
                    value={form.urgency}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        urgency: event.target.value as MaterialForm["urgency"],
                      }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="reason">Reason</Label>
                  <textarea
                    id="reason"
                    name="reason"
                    value={form.reason}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, reason: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Explain why this material is needed for the project."
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={submitting}>
                    <FiSend className="h-4 w-4" />
                    {submitting ? "Sending..." : "Send Request"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {visibleRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FiPackage className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">
                {role === "company"
                  ? "No worker or contractor requests yet"
                  : "No material requests yet"}
              </p>
              <p className="text-sm text-muted-foreground/70">
                {role === "company"
                  ? "Requests will appear here only after a worker or contractor sends one."
                  : "Requests will appear here once they are created."}
              </p>
            </CardContent>
          </Card>
        ) : (
          visibleRequests.map((request) => (
            <Card key={request.id} className="overflow-hidden">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg">{request.materialName}</CardTitle>
                    <CardDescription>
                      {request.project?.title || "Project unavailable"} ·{" "}
                      <span className="capitalize">{request.requestedByRole}</span>{" "}
                      request by {request.requesterName}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {request.requestedByRole}
                    </Badge>
                    <StatusBadge status={request.status} />
                    <Badge variant="outline" className={urgencyClass(request.urgency)}>
                      {request.urgency} urgency
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <p className="font-medium">
                      {request.quantity} {request.unit}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Requester</p>
                    <p className="font-medium capitalize">{request.requestedByRole}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Reason
                  </p>
                  <p className="text-sm">{request.reason}</p>
                </div>

                {(role === "company" || request.companyNote) && (
                  <div className="space-y-2">
                    <Label htmlFor={`company-note-${request.id}`}>Company note</Label>
                    <textarea
                      id={`company-note-${request.id}`}
                      value={companyNotes[request.id] || ""}
                      onChange={(event) =>
                        setCompanyNotes((prev) => ({
                          ...prev,
                          [request.id]: event.target.value,
                        }))
                      }
                      readOnly={role !== "company"}
                      className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
                      placeholder={role === "company" ? "Optional note for this request" : "No note yet"}
                    />
                  </div>
                )}

                {role === "company" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updatingId === request.id}
                      onClick={() => updateStatus(request.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updatingId === request.id}
                      onClick={() => updateStatus(request.id, "fulfilled")}
                    >
                      Mark Fulfilled
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === request.id}
                      onClick={() => updateStatus(request.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </motion.div>
  );
}
