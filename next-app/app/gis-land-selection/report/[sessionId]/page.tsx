"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useContractor } from "@/contexts/ContractorContext";
import { motion } from "framer-motion";
import {
  FiArrowLeft as ArrowLeft,
  FiBriefcase as Building2,
  FiCalendar as CalendarDays,
  FiCheckCircle as CheckCircle2,
  FiClipboard as ClipboardList,
  FiDownload as Download,
  FiFileText as FileText,
  FiTool as HardHat,
  FiLayers as Layers3,
  FiMaximize as Ruler,
  FiAlertTriangle as ShieldAlert,
  FiActivity as Sparkles,
  FiRefreshCw as TimerReset,
  FiUsers as Users,
} from "react-icons/fi";
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
    environmentalSummary?: {
      suitability_score: number;
      sensitivity_level: string;
      flood_risk_level: string;
      biodiversity_level: string;
      constraints: string[];
      opportunities: string[];
      nearby_features: string[];
      metrics: {
        nearest_water_distance_m: number | null;
        nearest_forest_distance_m: number | null;
        nearest_wetland_distance_m: number | null;
        natural_cover_ratio: number;
        water_overlap_area_sqm: number;
        protected_overlap_area_sqm: number;
        hazardous_landuse_count: number;
      };
    } | null;
    infrastructureSummary?: {
      readiness_score: number;
      readiness_level: string;
      utility_coverage_level: string;
      transit_access_level: string;
      available_utilities: string[];
      missing_utilities: string[];
      logistics_notes: string[];
      metrics: {
        nearest_power_distance_m: number | null;
        nearest_water_infra_distance_m: number | null;
        nearest_sewer_distance_m: number | null;
        nearest_telecom_distance_m: number | null;
        nearest_transit_distance_m: number | null;
        nearest_rail_distance_m: number | null;
      };
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


type ReportTab = "overview" | "timeline" | "materials" | "workforce" | "financial";

const REPORT_TABS: { id: ReportTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
  { id: "materials", label: "Materials", icon: Layers3 },
  { id: "workforce", label: "Workforce", icon: Users },
  { id: "financial", label: "Financials", icon: Building2 },
];

function formatNumber(value: number | null | undefined, fractionDigits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: fractionDigits });
}

function formatCurrencyINR(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
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
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-primary">
          {icon}
        </div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_34%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--background)))]" />
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
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");

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
      budget: data.report.payload.costEstimate ? formatCurrencyINR(data.report.payload.costEstimate.totalBudget) : "",
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/90 backdrop-blur-xl">
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
            <button
              onClick={async () => {
                const res = await fetch(`/api/contractor/workflow/reports?sessionId=${data.session.id}&format=bundle`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                  throw new Error("Unable to export stakeholder bundle");
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `gis-report-bundle-${data.session.id}.zip`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/15"
            >
              <Download className="h-4 w-4" />
              Stakeholder Bundle
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 shadow-[0_16px_48px_rgba(16,185,129,0.08)]">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Fit status
            </div>
            <p className="mt-3 text-2xl font-semibold capitalize text-white">{fitSummary.fitStatus || "unknown"}</p>
            <p className="mt-1 text-sm text-white/55">Fit score {formatNumber(fitSummary.fitScore, 1)}%</p>
          </div>
          <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5 shadow-[0_16px_48px_rgba(34,211,238,0.08)]">
            <div className="flex items-center gap-2 text-cyan-300">
              <Layers3 className="h-4 w-4" />
              Materials
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">{payload.materialTotals.totalElements}</p>
            <p className="mt-1 text-sm text-white/55">
              qty range {formatNumber(payload.materialTotals.totalQuantityRange.min)} - {formatNumber(payload.materialTotals.totalQuantityRange.max)}
            </p>
          </div>
          <div className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-5 shadow-[0_16px_48px_rgba(139,92,246,0.08)]">
            <div className="flex items-center gap-2 text-violet-300">
              <CalendarDays className="h-4 w-4" />
              Estimated days
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {payload.timeEstimate.durationRangeDays.min} - {payload.timeEstimate.durationRangeDays.max}
            </p>
            <p className="mt-1 text-sm text-white/55">midline {payload.timeEstimate.estimatedDurationDays} days</p>
          </div>
          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 shadow-[0_16px_48px_rgba(245,158,11,0.08)]">
            <div className="flex items-center gap-2 text-amber-300">
              <Users className="h-4 w-4" />
              Recommended crew
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {payload.workforceEstimate.totalWorkerRange.min} - {payload.workforceEstimate.totalWorkerRange.max}
            </p>
            <p className="mt-1 text-sm text-white/55">midline {totalWorkers}, peak {payload.workforceEstimate.peakCrewSize}</p>
          </div>
        </div>

        {(fitSummary.environmentalSummary || fitSummary.infrastructureSummary) && (
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {fitSummary.environmentalSummary && (
              <SectionCard title="Environmental Intelligence" icon={<ShieldAlert className="h-4 w-4" />}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200/70">Suitability</p>
                    <p className="mt-2 text-2xl font-semibold">{formatNumber(fitSummary.environmentalSummary.suitability_score, 1)}/100</p>
                    <p className="mt-1 text-sm text-white/60 capitalize">
                      sensitivity {fitSummary.environmentalSummary.sensitivity_level} · flood {fitSummary.environmentalSummary.flood_risk_level}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Mapped context</p>
                    <p className="mt-2 text-sm text-white/75">
                      {fitSummary.environmentalSummary.nearby_features.join(", ") || "No dominant ecological feature detected"}
                    </p>
                    <p className="mt-2 text-sm text-white/55">
                      Natural cover ratio {formatNumber(fitSummary.environmentalSummary.metrics.natural_cover_ratio * 100, 1)}%
                    </p>
                  </div>
                </div>
                {!!fitSummary.environmentalSummary.constraints.length && (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-200/70">Key constraints</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-50/85">
                      {fitSummary.environmentalSummary.constraints.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </SectionCard>
            )}

            {fitSummary.infrastructureSummary && (
              <SectionCard title="Infrastructure Readiness" icon={<Layers3 className="h-4 w-4" />}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/70">Readiness</p>
                    <p className="mt-2 text-2xl font-semibold">{formatNumber(fitSummary.infrastructureSummary.readiness_score, 1)}/100</p>
                    <p className="mt-1 text-sm text-white/60 capitalize">
                      utilities {fitSummary.infrastructureSummary.utility_coverage_level} · transit {fitSummary.infrastructureSummary.transit_access_level}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Available utilities</p>
                    <p className="mt-2 text-sm text-white/75">
                      {fitSummary.infrastructureSummary.available_utilities.join(", ") || "No mapped utility corridor nearby"}
                    </p>
                    <p className="mt-2 text-sm text-white/55">
                      Missing: {fitSummary.infrastructureSummary.missing_utilities.join(", ") || "None"}
                    </p>
                  </div>
                </div>
                {!!fitSummary.infrastructureSummary.logistics_notes.length && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Logistics notes</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
                      {fitSummary.infrastructureSummary.logistics_notes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-3 shadow-[0_16px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className="flex flex-wrap gap-2">
            {REPORT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${isActive ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100 shadow-[0_10px_24px_rgba(34,211,238,0.12)]" : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="mt-6"
        >
          {activeTab === "overview" && (
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <SectionCard title="Project Snapshot" icon={<Sparkles className="h-4 w-4" />}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Fit status</p>
                    <p className="mt-2 text-2xl font-semibold capitalize text-white">{fitSummary.fitStatus || "unknown"}</p>
                    <p className="mt-1 text-sm text-white/55">Fit score {formatNumber(fitSummary.fitScore, 1)}%</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Budget</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {payload.costEstimate ? formatCurrencyINR(payload.costEstimate.totalBudget) : "—"}
                    </p>
                    <p className="mt-1 text-sm text-white/55">Estimated total cost in INR</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Duration</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{payload.timeEstimate.estimatedDurationDays} days</p>
                    <p className="mt-1 text-sm text-white/55">
                      Range {payload.timeEstimate.durationRangeDays.min} - {payload.timeEstimate.durationRangeDays.max} days
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Crew</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{payload.workforceEstimate.totalRecommendedWorkers}</p>
                    <p className="mt-1 text-sm text-white/55">
                      Peak {payload.workforceEstimate.peakCrewSize} · range {payload.workforceEstimate.totalWorkerRange.min} - {payload.workforceEstimate.totalWorkerRange.max}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Report summary</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Session</p>
                      <p className="mt-1 text-sm text-white/80">{data.session.id}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Workflow</p>
                      <p className="mt-1 text-sm text-white/80">{data.session.workflowState}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Version</p>
                      <p className="mt-1 text-sm text-white/80">{data.report.versionNumber}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Material lines</p>
                      <p className="mt-1 text-sm text-white/80">{payload.detailedTakeoff.totalMaterialLines}</p>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Model Basis" icon={<Building2 className="h-4 w-4" />}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Aggregate geometry</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/75">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Elements</p>
                        <p className="mt-1 font-semibold text-white">{payload.dimensionSummary.totalElements}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Volume</p>
                        <p className="mt-1 font-semibold text-white">{formatNumber(payload.dimensionSummary.totalVolume)} cum</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Footprint</p>
                        <p className="mt-1 font-semibold text-white">{formatNumber(payload.dimensionSummary.totalFootprintArea)} sqm</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Surface</p>
                        <p className="mt-1 font-semibold text-white">{formatNumber(payload.dimensionSummary.totalSurfaceArea)} sqm</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Fit context</p>
                    <p className="mt-3 text-sm leading-6 text-white/70">
                      This report uses geometry-derived dimensions, then validates them against the IFC type labels. Timeline, workforce, and cost are then scaled from the actual footprint and material mix rather than a flat rule of thumb.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(payload.elementCounts).map(([type, count]) => (
                    <div key={type} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70">
                      <span className="uppercase tracking-[0.14em] text-white/40">{type}</span>
                      <span className="ml-2 font-semibold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <SectionCard title="Project Timeline" icon={<Sparkles className="h-4 w-4" />}>
                <ProjectTimeline phases={payload.projectTimeline || []} />
                <p className="mt-4 text-sm text-white/55">
                  Each phase is sequenced from planning through handoff with duration estimates, dependencies, and deliverables.
                </p>
              </SectionCard>

              <div className="space-y-6">
                <SectionCard title="Schedule Estimate" icon={<CalendarDays className="h-4 w-4" />}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Structural</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{payload.timeEstimate.phaseDays.structural} days</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Envelope</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{payload.timeEstimate.phaseDays.envelope} days</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Finishes</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{payload.timeEstimate.phaseDays.finishes} days</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Services</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{payload.timeEstimate.phaseDays.services} days</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-white/55">
                    Duration band: {payload.timeEstimate.durationRangeDays.min} - {payload.timeEstimate.durationRangeDays.max} days. {payload.timeEstimate.basis}
                  </p>
                </SectionCard>

                <SectionCard title="Project Handoff" icon={<Building2 className="h-4 w-4" />}>
                  <div className="space-y-4 text-sm text-white/75">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Next step</p>
                      <p className="mt-2 text-white/80">{payload.projectHandoff.nextStep}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
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
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === "materials" && (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <SectionCard title="Takeoff Summary" icon={<ClipboardList className="h-4 w-4" />}>
                <div className="space-y-4 text-sm text-white/75">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {Object.entries(payload.elementCounts).map(([type, count]) => (
                      <div key={type} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">{type}</p>
                        <p className="mt-1 text-lg font-semibold text-white">{count}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Detailed structural counts</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {payload.detailedTakeoff.structural.map((item) => (
                        <div key={item.type} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                          <span className="capitalize text-white/80">{item.type}</span>
                          <span className="text-white/90">{item.count} · {formatNumber(item.quantity)} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Openings</p>
                      <div className="mt-3 space-y-2">
                        {payload.detailedTakeoff.openings.map((item) => (
                          <div key={item.type} className="flex items-center justify-between text-sm text-white/75">
                            <span className="capitalize">{item.type}</span>
                            <span>{item.count} · {formatNumber(item.quantity)} {item.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Other elements</p>
                      <div className="mt-3 space-y-2">
                        {payload.detailedTakeoff.others.length ? (
                          payload.detailedTakeoff.others.map((item) => (
                            <div key={item.type} className="flex items-center justify-between text-sm text-white/75">
                              <span className="capitalize">{item.type}</span>
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
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  <div className="max-h-[30rem] overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[#151b29] text-white/45">
                        <tr>
                          <th className="px-3 py-2 font-medium">Material</th>
                          <th className="px-3 py-2 font-medium">Element</th>
                          <th className="px-3 py-2 font-medium">Qty</th>
                          <th className="px-3 py-2 font-medium">Basis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payload.materialEstimate.map((row) => (
                          <tr key={`${row.material}-${row.elementType}-${row.unit}`} className="border-t border-white/10 align-top">
                            <td className="px-3 py-2 text-white/85">{row.material}</td>
                            <td className="px-3 py-2 text-white/70 capitalize">{row.elementType}</td>
                            <td className="px-3 py-2 text-white/85">
                              {formatNumber(row.quantityRange.min)} - {formatNumber(row.quantityRange.max)} {row.unit}
                              <div className="text-[11px] text-white/45">mid {formatNumber(row.quantity)} {row.unit}</div>
                            </td>
                            <td className="px-3 py-2 text-white/55">{row.basis}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Material totals</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{payload.materialTotals.totalElements}</p>
                    <p className="text-sm text-white/50">
                      quantity range {formatNumber(payload.materialTotals.totalQuantityRange.min)} - {formatNumber(payload.materialTotals.totalQuantityRange.max)}
                    </p>
                    <p className="text-sm text-white/50">mid {formatNumber(payload.materialTotals.totalQuantity)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Model context</p>
                    <p className="mt-2 text-sm text-white/70">Session version {data.session.currentVersionNumber}</p>
                    <p className="text-sm text-white/70">Validation snapshot {data.validationSnapshot?.status ?? "missing"}</p>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === "workforce" && (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <SectionCard title="Phase Workforce Plan" icon={<Users className="h-4 w-4" />}>
                <PhaseWorkforceGrid phases={payload.workforceByPhase || []} />
              </SectionCard>

              <SectionCard title="Crew Mix" icon={<HardHat className="h-4 w-4" />}>
                <div className="grid gap-3 md:grid-cols-2">
                  {payload.recommendedWorkerMix.map((worker) => (
                    <div key={worker.role} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 flex items-center justify-between">
                      <span className="capitalize text-white/80">{worker.role.replaceAll("_", " ")}</span>
                      <span className="font-semibold text-white">{worker.count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Recommended workers</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{payload.workforceEstimate.totalRecommendedWorkers}</p>
                    <p className="mt-1 text-sm text-white/55">
                      range {payload.workforceEstimate.totalWorkerRange.min} - {payload.workforceEstimate.totalWorkerRange.max}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Peak crew size</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{payload.workforceEstimate.peakCrewSize}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Handoff</p>
                    <p className="mt-2 text-sm text-white/70">Ready for company approval and hiring gate.</p>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === "financial" && payload.costEstimate && (
            <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <SectionCard title="Financial Estimate" icon={<Building2 className="h-4 w-4" />}>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Material cost</p>
                    <p className="mt-2 text-xl font-semibold text-white">{formatCurrencyINR(payload.costEstimate.totalMaterialCost)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Labour cost</p>
                    <p className="mt-2 text-xl font-semibold text-white">{formatCurrencyINR(payload.costEstimate.totalLaborCost)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Contingency (10%)</p>
                    <p className="mt-2 text-xl font-semibold text-white">{formatCurrencyINR(payload.costEstimate.contingencyCost)}</p>
                  </div>
                  <div className="col-span-full rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 mt-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">Estimated total budget</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-100">{formatCurrencyINR(payload.costEstimate.totalBudget)}</p>
                    <p className="mt-1 text-[11px] text-white/50">Includes materials, labour, and 10% contingency.</p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Project Handoff" icon={<Building2 className="h-4 w-4" />}>
                <div className="space-y-4 text-sm text-white/75">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Next step</p>
                    <p className="mt-2 text-white/80">{payload.projectHandoff.nextStep}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
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
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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
          )}
        </motion.div>
      </main>
    </div>
  );
}
