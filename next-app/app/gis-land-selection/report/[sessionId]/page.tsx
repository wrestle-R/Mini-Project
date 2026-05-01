"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useContractor } from "@/contexts/ContractorContext";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, ClipboardList, Download, FileText, HardHat, Layers3, Ruler, ShieldAlert, Sparkles, TimerReset, Users } from "lucide-react";
import { ProjectTimeline, type ProjectTimelinePhase } from "@/components/gis/project-timeline";
import { PhaseWorkforceGrid, type PhaseWorkforce } from "@/components/gis/phase-workforce-grid";

type ReportPayload = {
  schemaVersion: number;
  generatedFrom: {
    ifcSessionId: string;
    ifcProjectId: string | null;
    ifcVersionNumber: number;
    validationSnapshotId: string;
  };
  fitSummary: {
    fitStatus: string | null;
    fitScore: number | null;
    landAreaSqm: number | null;
    footprintAreaSqm: number | null;
    utilizationRatio: number | null;
    roadAccess: {
      nearest_road_distance_m: number | null;
      has_road_access: boolean;
      warning?: string | null;
    } | null;
  };
  elementCounts: Record<string, number>;
  detailedTakeoff: {
    structural: { type: string; count: number; quantity: number; unit: string }[];
    openings: { type: string; count: number; quantity: number; unit: string }[];
    others: { type: string; count: number; quantity: number; unit: string }[];
    elementCounts: Record<string, number>;
    dimensionSummary: {
      totalElements: number;
      totalVolume: number;
      totalFootprintArea: number;
      totalSurfaceArea: number;
    };
    totalMaterialLines: number;
  };
  materialEstimate: {
    material: string;
    elementType: string;
    elementCount: number;
    quantity: number;
    quantityRange: { min: number; max: number };
    unit: string;
    basis: string;
  }[];
  materialsByPhase: {
    phaseId: string;
    phaseName: string;
    materials: {
      material: string;
      elementType: string;
      elementCount: number;
      quantity: number;
      quantityRange: { min: number; max: number };
      unit: string;
      basis: string;
    }[];
  }[];
  materialTotals: {
    totalElements: number;
    totalQuantity: number;
    totalQuantityRange: { min: number; max: number };
  };
  timeEstimate: {
    estimatedDurationDays: number;
    durationRangeDays: { min: number; max: number };
    phaseDays: {
      structural: number;
      envelope: number;
      finishes: number;
      services: number;
    };
    basis: string;
  };
  projectTimeline: ProjectTimelinePhase[];
  recommendedWorkerMix: { role: string; count: number }[];
  workforceEstimate: {
    totalRecommendedWorkers: number;
    peakCrewSize: number;
    totalWorkerRange: { min: number; max: number };
    recommendedWorkerMix: { role: string; count: number }[];
  };
  workforceByPhase: PhaseWorkforce[];
  dimensionSummary: {
    totalElements: number;
    totalVolume: number;
    totalFootprintArea: number;
    totalSurfaceArea: number;
  };
  elementAssessments: {
    id: string;
    name: string;
    rawType: string;
    classification: string;
    dimensions: { width: number; depth: number; height: number };
    metrics: { faceArea: number; volume: number };
    laborDays: number;
  }[];
  projectHandoff: {
    warnings: string[];
    assumptions: string[];
    nextStep: string;
  };
  costEstimate?: {
    totalMaterialCost: number;
    totalLaborCost: number;
    subtotalCost: number;
    contingencyCost: number;
    totalBudget: number;
    materialCosts: Record<string, number>;
  };
};

type ReportResponse = {
  report: {
    id: string;
    versionNumber: number;
    status: string;
    generatedAt: string;
    payload: ReportPayload;
  };
  session: {
    id: string;
    title: string;
    workflowState: string;
    currentVersionNumber: number;
  };
  validationSnapshot: {
    id: string;
    status: string;
    completedAt: string;
    fitResult: Record<string, unknown>;
    parcelSummary: { areaSqm: number | null; centroid: number[] };
    modelDimensions: { width_m: number; depth_m: number; height_m: number; up_axis?: string };
  } | null;
};

function formatNumber(value: number | null | undefined, fractionDigits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0f1420]/90 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-cyan-300">
          {icon}
        </div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ReportLoadingState() {
  const steps = [
    { label: "Reading IFC model", accent: "from-cyan-300 to-sky-400" },
    { label: "Building timeline", accent: "from-sky-300 to-emerald-300" },
    { label: "Sizing workforce", accent: "from-emerald-300 to-lime-300" },
    { label: "Rendering report", accent: "from-amber-300 to-orange-300" },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#050811] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.14),_transparent_30%),linear-gradient(180deg,_rgba(6,10,19,1),_rgba(3,6,12,1))]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-14">
        <div className="grid w-full gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-200/80">
              <Sparkles className="h-3.5 w-3.5" />
              Generating project report
            </div>
            <div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight md:text-6xl">
                The workflow is planning your project in phases.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/60 md:text-lg">
                Timeline, materials, and workforce are being assembled synchronously. The report will include animated phase planning and a phase-wise labor breakdown.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {steps.map((step, index) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.12 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white/90">{step.label}</p>
                    <TimerReset className="h-4 w-4 text-cyan-300" />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ x: "-35%" }}
                      animate={{ x: ["-35%", "110%"] }}
                      transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                      className={`h-full w-1/2 rounded-full bg-gradient-to-r ${step.accent}`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative rounded-[2rem] border border-white/10 bg-[#0a111e]/90 p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
            <div className="absolute inset-y-10 left-10 w-px bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent" />
            <div className="grid gap-3">
              {steps.map((step, index) => (
                <motion.div
                  key={`${step.label}-lane`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.15 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Stage {index + 1}</p>
                      <p className="mt-1 text-base font-semibold text-white">{step.label}</p>
                    </div>
                    <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5" />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-white/45">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Planning</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Materials</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Crew</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GisReportPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const { token } = useContractor();
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !params?.sessionId) return;

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/contractor/workflow/reports?sessionId=${params.sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || "Unable to load report");
        }
        setData(json as ReportResponse);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Unable to load report");
        }
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [token, params?.sessionId]);

  const totalWorkers = useMemo(
    () => data?.report.payload.workforceEstimate.totalRecommendedWorkers ?? 0,
    [data]
  );

  const handlePrepareProjectDraft = async () => {
    if (!data) return;

    const centroid = data.validationSnapshot?.parcelSummary.centroid ?? [];
    const draft = {
      title: `${data.session.title.replace(/\.[^.]+$/, "")} - Project Draft`,
      description: [
        `Generated from GIS report v${data.report.versionNumber}.`,
        `Fit score: ${formatNumber(data.report.payload.fitSummary.fitScore, 1)}%.`,
        `Estimated duration: ${data.report.payload.timeEstimate.estimatedDurationDays} days.`,
        `Recommended workers: ${data.report.payload.workforceEstimate.totalRecommendedWorkers}.`,
      ].join(" "),
      location: {
        displayName: "GIS-selected parcel",
        lat: typeof centroid[1] === "number" ? centroid[1] : null,
        lng: typeof centroid[0] === "number" ? centroid[0] : null,
      },
      budget: data.report.payload.costEstimate ? `$${formatNumber(data.report.payload.costEstimate.totalBudget, 0)}` : "",
      source: {
        sessionId: data.session.id,
        reportId: data.report.id,
        validationSnapshotId: data.validationSnapshot?.id ?? null,
      },
    };

    localStorage.setItem("gis_report_project_draft", JSON.stringify(draft));
    router.push("/company/projects");
  };

  if (loading) {
    return <ReportLoadingState />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#060910] text-white">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
            <div className="flex items-center gap-3 text-red-200">
              <ShieldAlert className="h-5 w-5" />
              <h1 className="text-xl font-semibold">Report unavailable</h1>
            </div>
            <p className="mt-3 text-sm text-white/70">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const payload = data.report.payload;
  const fitSummary = payload.fitSummary;

  return (
    <div className="min-h-screen bg-[#060910] text-white">
      <div className="border-b border-white/10 bg-[#090d15]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-cyan-300/70">
              <FileText className="h-4 w-4" />
              Detailed Construction Report
            </div>
            <h1 className="mt-1 text-2xl font-semibold">{data.session.title}</h1>
            <p className="mt-1 text-sm text-white/45">
              Session {data.session.id} · Workflow {data.session.workflowState} · Version {data.report.versionNumber}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to GIS
            </button>
            <Link
              href="/company/projects"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/15"
            >
              <Building2 className="h-4 w-4" />
              Open Project Workspace
            </Link>
            <button
              onClick={handlePrepareProjectDraft}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/15"
            >
              <Building2 className="h-4 w-4" />
              Prepare Project Draft
            </button>
            <button
              onClick={async () => {
                const res = await fetch(`/api/contractor/workflow/reports?sessionId=${data.session.id}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `report-${data.session.id}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              JSON
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Fit status
            </div>
            <p className="mt-3 text-2xl font-semibold capitalize">{fitSummary.fitStatus || "unknown"}</p>
            <p className="mt-1 text-sm text-white/55">Fit score {formatNumber(fitSummary.fitScore, 1)}%</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 text-cyan-300">
              <Layers3 className="h-4 w-4" />
              Materials
            </div>
            <p className="mt-3 text-2xl font-semibold">{payload.materialTotals.totalElements}</p>
            <p className="mt-1 text-sm text-white/55">
              qty range {formatNumber(payload.materialTotals.totalQuantityRange.min)} - {formatNumber(payload.materialTotals.totalQuantityRange.max)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 text-violet-300">
              <CalendarDays className="h-4 w-4" />
              Estimated days
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {payload.timeEstimate.durationRangeDays.min} - {payload.timeEstimate.durationRangeDays.max}
            </p>
            <p className="mt-1 text-sm text-white/55">midline {payload.timeEstimate.estimatedDurationDays} days</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 text-amber-300">
              <Users className="h-4 w-4" />
              Recommended crew
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {payload.workforceEstimate.totalWorkerRange.min} - {payload.workforceEstimate.totalWorkerRange.max}
            </p>
            <p className="mt-1 text-sm text-white/55">midline {totalWorkers}, peak {payload.workforceEstimate.peakCrewSize}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SectionCard title="Project Timeline" icon={<Sparkles className="h-4 w-4" />}>
            <ProjectTimeline phases={payload.projectTimeline || []} />
            <p className="mt-4 text-sm text-white/55">
              Each phase is sequenced from planning through handoff with duration estimates and deliverables.
            </p>
          </SectionCard>

          <SectionCard title="Phase Workforce Plan" icon={<Users className="h-4 w-4" />}>
            <PhaseWorkforceGrid phases={payload.workforceByPhase || []} />
          </SectionCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SectionCard title="Takeoff Summary" icon={<ClipboardList className="h-4 w-4" />}>
            <div className="space-y-4 text-sm text-white/75">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Object.entries(payload.elementCounts).map(([type, count]) => (
                  <div key={type} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">{type}</p>
                    <p className="mt-1 text-lg font-semibold">{count}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Detailed structural counts</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {payload.detailedTakeoff.structural.map((item) => (
                    <div key={item.type} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <span>{item.type}</span>
                      <span className="text-white/90">{item.count} · {formatNumber(item.quantity)} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Openings</p>
                  <div className="mt-3 space-y-2">
                    {payload.detailedTakeoff.openings.map((item) => (
                      <div key={item.type} className="flex items-center justify-between text-sm">
                        <span>{item.type}</span>
                        <span>{item.count} · {formatNumber(item.quantity)} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Other elements</p>
                  <div className="mt-3 space-y-2">
                    {payload.detailedTakeoff.others.length ? (
                      payload.detailedTakeoff.others.map((item) => (
                        <div key={item.type} className="flex items-center justify-between text-sm">
                          <span>{item.type}</span>
                          <span>{item.count} · {formatNumber(item.quantity)} {item.unit}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-white/45">No additional element classes detected.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Material Estimate" icon={<Ruler className="h-4 w-4" />}>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-white/45">
                  <tr>
                    <th className="px-3 py-2 font-medium">Material</th>
                    <th className="px-3 py-2 font-medium">Element</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.materialEstimate.map((row) => (
                    <tr key={`${row.material}-${row.elementType}-${row.unit}`} className="border-t border-white/10">
                      <td className="px-3 py-2 text-white/85">{row.material}</td>
                      <td className="px-3 py-2 text-white/70">{row.elementType}</td>
                      <td className="px-3 py-2 text-white/85">
                        {formatNumber(row.quantityRange.min)} - {formatNumber(row.quantityRange.max)} {row.unit}
                        <div className="text-[11px] text-white/45">mid {formatNumber(row.quantity)} {row.unit}</div>
                      </td>
                      <td className="px-3 py-2 text-white/50">{row.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Material totals</p>
                <p className="mt-2 text-2xl font-semibold">{payload.materialTotals.totalElements}</p>
                <p className="text-sm text-white/50">
                  quantity range {formatNumber(payload.materialTotals.totalQuantityRange.min)} - {formatNumber(payload.materialTotals.totalQuantityRange.max)}
                </p>
                <p className="text-sm text-white/50">mid {formatNumber(payload.materialTotals.totalQuantity)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Model context</p>
                <p className="mt-2 text-sm text-white/70">Session version {data.session.currentVersionNumber}</p>
                <p className="text-sm text-white/70">Validation snapshot {data.validationSnapshot?.status ?? "missing"}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Schedule Estimate" icon={<CalendarDays className="h-4 w-4" />}>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Structural</p>
                <p className="mt-2 text-xl font-semibold">{payload.timeEstimate.phaseDays.structural} days</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Envelope</p>
                <p className="mt-2 text-xl font-semibold">{payload.timeEstimate.phaseDays.envelope} days</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Finishes</p>
                <p className="mt-2 text-xl font-semibold">{payload.timeEstimate.phaseDays.finishes} days</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Services</p>
                <p className="mt-2 text-xl font-semibold">{payload.timeEstimate.phaseDays.services} days</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/55">
              Duration band: {payload.timeEstimate.durationRangeDays.min} - {payload.timeEstimate.durationRangeDays.max} days. {payload.timeEstimate.basis}
            </p>
          </SectionCard>

          <SectionCard title="Workforce Estimate" icon={<HardHat className="h-4 w-4" />}>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Recommended workers</p>
                <p className="mt-2 text-2xl font-semibold">{payload.workforceEstimate.totalRecommendedWorkers}</p>
                <p className="mt-1 text-sm text-white/55">
                  range {payload.workforceEstimate.totalWorkerRange.min} - {payload.workforceEstimate.totalWorkerRange.max}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Peak crew size</p>
                <p className="mt-2 text-2xl font-semibold">{payload.workforceEstimate.peakCrewSize}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Project handoff</p>
                <p className="mt-2 text-sm text-white/70">Ready for company approval and hiring gate.</p>
              </div>
            </div>

                  <SectionCard title="Element Basis" icon={<FileText className="h-4 w-4" />}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/40">Aggregate geometry</p>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/75">
                          <div>
                            <p className="text-white/40 text-[11px] uppercase tracking-[0.14em]">Elements</p>
                            <p className="mt-1 font-semibold">{payload.dimensionSummary.totalElements}</p>
                          </div>
                          <div>
                            <p className="text-white/40 text-[11px] uppercase tracking-[0.14em]">Total volume</p>
                            <p className="mt-1 font-semibold">{formatNumber(payload.dimensionSummary.totalVolume)} cum</p>
                          </div>
                          <div>
                            <p className="text-white/40 text-[11px] uppercase tracking-[0.14em]">Footprint area</p>
                            <p className="mt-1 font-semibold">{formatNumber(payload.dimensionSummary.totalFootprintArea)} sqm</p>
                          </div>
                          <div>
                            <p className="text-white/40 text-[11px] uppercase tracking-[0.14em]">Surface area</p>
                            <p className="mt-1 font-semibold">{formatNumber(payload.dimensionSummary.totalSurfaceArea)} sqm</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/40">Strict basis</p>
                        <p className="mt-3 text-sm leading-6 text-white/70">
                          Each element is classified from its bounding dimensions first, then checked against its IFC type label. Material takeoff, crew counts, and schedule all use the geometry-derived dimensions and safety allowances shown below.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      <div className="max-h-[26rem] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="sticky top-0 bg-[#141927] text-white/45">
                            <tr>
                              <th className="px-3 py-2 font-medium">Element</th>
                              <th className="px-3 py-2 font-medium">Class</th>
                              <th className="px-3 py-2 font-medium">Dimensions</th>
                              <th className="px-3 py-2 font-medium">Area / Vol.</th>
                              <th className="px-3 py-2 font-medium">Labor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payload.elementAssessments.map((item) => (
                              <tr key={item.id} className="border-t border-white/10 align-top">
                                <td className="px-3 py-2 text-white/85">
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-[11px] text-white/40 break-all">{item.rawType}</div>
                                </td>
                                <td className="px-3 py-2 text-white/70 capitalize">{item.classification}</td>
                                <td className="px-3 py-2 text-white/75">
                                  {formatNumber(item.dimensions.width, 2)}m x {formatNumber(item.dimensions.depth, 2)}m x {formatNumber(item.dimensions.height, 2)}m
                                </td>
                                <td className="px-3 py-2 text-white/75">
                                  {formatNumber(item.metrics.faceArea)} sqm
                                  <div className="text-[11px] text-white/45">vol {formatNumber(item.metrics.volume)} cum</div>
                                </td>
                                <td className="px-3 py-2 text-white/75">{formatNumber(item.laborDays)} days</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </SectionCard>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {payload.recommendedWorkerMix.map((worker) => (
                <div key={worker.role} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
                  <span className="capitalize text-white/80">{worker.role.replaceAll("_", " ")}</span>
                  <span className="font-semibold">{worker.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {payload.costEstimate && (
            <SectionCard title="Financial Estimate" icon={<Building2 className="h-4 w-4" />}>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Material Cost</p>
                  <p className="mt-2 text-xl font-semibold">${formatNumber(payload.costEstimate.totalMaterialCost, 0)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Labor Cost</p>
                  <p className="mt-2 text-xl font-semibold">${formatNumber(payload.costEstimate.totalLaborCost, 0)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Contingency (10%)</p>
                  <p className="mt-2 text-xl font-semibold">${formatNumber(payload.costEstimate.contingencyCost, 0)}</p>
                </div>
                <div className="col-span-full rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 mt-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">Estimated Total Budget</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-100">${formatNumber(payload.costEstimate.totalBudget, 0)}</p>
                  <p className="mt-1 text-[11px] text-white/50">Includes materials, labor, and 10% contingency.</p>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Project Handoff" icon={<Building2 className="h-4 w-4" />}>
            <div className="space-y-4 text-sm text-white/75">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Next step</p>
                <p className="mt-2 text-white/80">{payload.projectHandoff.nextStep}</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-200/70">Warnings</p>
                {payload.projectHandoff.warnings.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-100/85">
                    {payload.projectHandoff.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-white/65">No critical warnings detected.</p>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Assumptions</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-white/70">
                  {payload.projectHandoff.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </div>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}
