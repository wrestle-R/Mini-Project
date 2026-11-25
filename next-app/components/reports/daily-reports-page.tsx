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
  FiCalendar,
  FiClock,
  FiFileText,
  FiFilter,
  FiMail,
  FiPlus,
  FiSend,
  FiUsers,
} from "react-icons/fi";

type Role = "worker" | "contractor" | "company";

type ProjectOption = {
  id: string;
  title: string;
  status: string;
};

type DailyReport = {
  id: string;
  project: ProjectOption | null;
  requesterRole: "worker" | "contractor" | "company";
  requesterName: string;
  reportDate: string;
  workSummary: string;
  manpowerCount: number;
  materialsUsed: string;
  blockers: string;
  nextDayPlan: string;
  notes: string;
  createdAt: string;
};

type ReportForm = {
  projectId: string;
  reportDate: string;
  workSummary: string;
  manpowerCount: string;
  materialsUsed: string;
  blockers: string;
  nextDayPlan: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_FORM: ReportForm = {
  projectId: "",
  reportDate: today(),
  workSummary: "",
  manpowerCount: "1",
  materialsUsed: "",
  blockers: "",
  nextDayPlan: "",
  notes: "",
};

function roleBadgeClass(role: DailyReport["requesterRole"]) {
  if (role === "worker") {
    return "border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300";
  }
  if (role === "company") {
    return "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300";
  }
  return "border-violet-200 text-violet-700 dark:border-violet-900 dark:text-violet-300";
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DailyReportsPage({ role }: { role: Role }) {
  const { firebaseUser } = useWorker();
  const { token: contractorToken } = useContractor();
  const { token: companyToken } = useCompany();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingWeekly, setSendingWeekly] = useState(false);
  const [savingRecipients, setSavingRecipients] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "worker" | "contractor" | "company">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [form, setForm] = useState<ReportForm>(DEFAULT_FORM);

  const canCreate = true;

  const getAuthHeader = useCallback(async () => {
    if (role === "worker") {
      const token = await firebaseUser?.getIdToken();
      return token ? `Bearer ${token}` : null;
    }
    const token = role === "contractor" ? contractorToken : companyToken;
    return token ? `Bearer ${token}` : null;
  }, [companyToken, contractorToken, firebaseUser, role]);

  const fetchReports = useCallback(async () => {
    const auth = await getAuthHeader();
    if (!auth) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projectFilter !== "all") params.set("projectId", projectFilter);
      if (role !== "worker" && roleFilter !== "all") params.set("role", roleFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/daily-reports?${params.toString()}`, {
        headers: { Authorization: auth },
      });
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(data.reports || []);
      setProjects(data.projects || []);
    } catch {
      toast.error("Failed to load daily reports");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, getAuthHeader, projectFilter, role, roleFilter]);

  const fetchRecipients = useCallback(async () => {
    if (role !== "company") return;
    const auth = await getAuthHeader();
    if (!auth) return;
    try {
      const res = await fetch("/api/company/report-email/settings", {
        headers: { Authorization: auth },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setRecipientsText((data.recipients || []).join(", "));
    } catch {
      toast.error("Failed to load report recipients");
    }
  }, [getAuthHeader, role]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    void fetchRecipients();
  }, [fetchRecipients]);

  useEffect(() => {
    if (!form.projectId && projects.length > 0) {
      setForm((prev) => ({ ...prev, projectId: projects[0].id }));
    }
  }, [form.projectId, projects]);

  const counts = useMemo(
    () => ({
      total: reports.length,
      worker: reports.filter((report) => report.requesterRole === "worker").length,
      contractor: reports.filter((report) => report.requesterRole === "contractor").length,
      company: reports.filter((report) => report.requesterRole === "company").length,
      blocked: reports.filter((report) => report.blockers?.trim()).length,
    }),
    [reports]
  );

  const groupedReports = useMemo(() => {
    const groups = new Map<string, DailyReport[]>();
    for (const report of reports) {
      const key = `${report.project?.title || "Project unavailable"}|${report.reportDate.slice(0, 10)}`;
      groups.set(key, [...(groups.get(key) || []), report]);
    }
    return [...groups.entries()].map(([key, items]) => {
      const [projectTitle, date] = key.split("|");
      return { key, projectTitle, date, items };
    });
  }, [reports]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const auth = await getAuthHeader();
    if (!auth) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to save report");
      toast.success("Daily report saved");
      setForm((prev) => ({ ...DEFAULT_FORM, projectId: prev.projectId }));
      void fetchReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save report");
    } finally {
      setSubmitting(false);
    }
  };

  const saveRecipients = async () => {
    const auth = await getAuthHeader();
    if (!auth) return;
    setSavingRecipients(true);
    try {
      const recipients = recipientsText
        .split(/[,\n]/)
        .map((recipient) => recipient.trim())
        .filter(Boolean);
      const res = await fetch("/api/company/report-email/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
        body: JSON.stringify({ recipients }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to save recipients");
      setRecipientsText((data.recipients || []).join(", "));
      toast.success("Report recipients saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save recipients");
    } finally {
      setSavingRecipients(false);
    }
  };

  const sendWeekly = async () => {
    const auth = await getAuthHeader();
    if (!auth) return;
    setSendingWeekly(true);
    try {
      const body = projectFilter !== "all" ? { projectId: projectFilter } : {};
      const res = await fetch("/api/company/report-email/send-weekly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to send weekly report");
      toast.success(`Sent ${data.sentCount} weekly report email${data.sentCount === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send weekly report");
    } finally {
      setSendingWeekly(false);
    }
  };

  const heading =
    role === "company"
      ? "Daily Reports"
      : role === "contractor"
        ? "Project Daily Reports"
        : "My Daily Reports";

  const description =
    role === "company"
      ? "Track progress day by day across projects and add company-side updates."
      : "Send daily project progress updates to the company.";

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
            {showForm ? "Hide Form" : "New Report"}
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <FiFileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-semibold">{counts.total}</p>
              <p className="text-xs text-muted-foreground">Reports</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <FiUsers className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-semibold">{counts.worker}</p>
              <p className="text-xs text-muted-foreground">Worker</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <FiClock className="h-5 w-5 text-violet-500" />
            <div>
              <p className="text-2xl font-semibold">{counts.contractor}</p>
              <p className="text-xs text-muted-foreground">Contractor</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <FiFilter className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-semibold">
                {role === "company" ? counts.company : counts.blocked}
              </p>
              <p className="text-xs text-muted-foreground">
                {role === "company" ? "Company" : "With blockers"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="report-project-filter">Project</Label>
            <select
              id="report-project-filter"
              name="projectFilter"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
          {role !== "worker" && (
            <div className="space-y-2">
              <Label htmlFor="report-role-filter">Submitted by</Label>
              <select
                id="report-role-filter"
                name="roleFilter"
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as "all" | "worker" | "contractor" | "company")
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All updates</option>
                <option value="worker">Workers</option>
                <option value="contractor">Contractors</option>
                {role === "company" && <option value="company">Company</option>}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="report-date-from">From</Label>
            <Input
              id="report-date-from"
              name="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-date-to">To</Label>
            <Input
              id="report-date-to"
              name="dateTo"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {role === "company" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FiMail className="h-4 w-4" />
              Weekly PDF Email
            </CardTitle>
            <CardDescription>
              Save report recipients and manually send the previous 7 days before cron is enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="report-recipients">Recipients</Label>
              <textarea
                id="report-recipients"
                name="reportRecipients"
                value={recipientsText}
                onChange={(event) => setRecipientsText(event.target.value)}
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="site.manager@example.com, owner@example.com"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={saveRecipients} disabled={savingRecipients}>
                {savingRecipients ? "Saving..." : "Save recipients"}
              </Button>
              <Button type="button" onClick={sendWeekly} disabled={sendingWeekly}>
                <FiSend className="h-4 w-4" />
                {sendingWeekly ? "Sending..." : "Send weekly PDF"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canCreate && showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FiCalendar className="h-4 w-4" />
              Add Daily Update
            </CardTitle>
            <CardDescription>
              {role === "company"
                ? "Add a company-side project update for the timeline."
                : "Record what changed today, manpower used, blockers, and the next-day plan."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No eligible projects found for daily reports.
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
                  <Label htmlFor="reportDate">Report date</Label>
                  <Input
                    id="reportDate"
                    name="reportDate"
                    type="date"
                    value={form.reportDate}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, reportDate: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manpowerCount">Manpower count</Label>
                  <Input
                    id="manpowerCount"
                    name="manpowerCount"
                    type="number"
                    min="0"
                    value={form.manpowerCount}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, manpowerCount: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="workSummary">Work summary</Label>
                  <textarea
                    id="workSummary"
                    name="workSummary"
                    value={form.workSummary}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, workSummary: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Describe the progress completed today."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materialsUsed">Materials used</Label>
                  <textarea
                    id="materialsUsed"
                    name="materialsUsed"
                    value={form.materialsUsed}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, materialsUsed: event.target.value }))
                    }
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Cement, steel rods, wiring..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blockers">Blockers</Label>
                  <textarea
                    id="blockers"
                    name="blockers"
                    value={form.blockers}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, blockers: event.target.value }))
                    }
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Delays, missing materials, approvals..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nextDayPlan">Next-day plan</Label>
                  <textarea
                    id="nextDayPlan"
                    name="nextDayPlan"
                    value={form.nextDayPlan}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, nextDayPlan: event.target.value }))
                    }
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="What should happen next?"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={submitting}>
                    <FiSend className="h-4 w-4" />
                    {submitting ? "Saving..." : "Save Report"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {groupedReports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FiFileText className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">No daily reports yet</p>
              <p className="text-sm text-muted-foreground/70">
                Reports will appear here after updates are submitted.
              </p>
            </CardContent>
          </Card>
        ) : (
          groupedReports.map((group) => (
            <Card key={group.key} className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.projectTitle}</CardTitle>
                    <CardDescription>{formatDate(group.date)}</CardDescription>
                  </div>
                  <Badge variant="secondary">{group.items.length} update{group.items.length === 1 ? "" : "s"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.items.map((report) => (
                  <div key={report.id} className="rounded-xl border p-4">
                    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium">{report.requesterName}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.manpowerCount} people on site
                        </p>
                      </div>
                      <Badge variant="outline" className={roleBadgeClass(report.requesterRole)}>
                        {report.requesterRole}
                      </Badge>
                    </div>
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-lg bg-muted/30 p-3 md:col-span-2">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Work completed
                        </p>
                        <p>{report.workSummary}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Materials used
                        </p>
                        <p>{report.materialsUsed || "—"}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Blockers
                        </p>
                        <p>{report.blockers || "—"}</p>
                      </div>
                      <div className="rounded-lg border p-3 md:col-span-2">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Next-day plan
                        </p>
                        <p>{report.nextDayPlan || "—"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </motion.div>
  );
}
