"use client";

import { FiAlertTriangle, FiCheckCircle, FiTrendingUp } from "react-icons/fi";

interface FitValidationResult {
  fit_status: "valid" | "partial" | "invalid";
  fit_score: number;
  inside_area_sqm: number;
  overflow_area_sqm: number;
  model_footprint_area_sqm: number;
  land_area_sqm: number;
  utilization_ratio: number;
  suggested_rotation_deg: number;
  messages: string[];
  environmental_summary?: { suitability_score: number } | null;
  infrastructure_summary?: { readiness_score: number } | null;
}

function FitGauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const radius = 36;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  const remaining = circumference - dash;

  return (
    <svg width={100} height={80} viewBox="0 0 100 80">
      <g transform="translate(50,50)">
        <circle r={radius} stroke="#111827" strokeWidth={stroke} fill="none" opacity={0.9} />
        <circle
          r={radius}
          stroke="#10b981"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${remaining}`}
          strokeLinecap="round"
          transform="rotate(-90)"
        />
        <text x="0" y="6" textAnchor="middle" fontSize={16} fill="#e6f2ff" fontWeight={700}>
          {Math.round(pct * 100)}%
        </text>
      </g>
    </svg>
  );
}

function SmallBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="text-xs">
      <div className="flex justify-between mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div className="w-full bg-white/5 rounded h-2 overflow-hidden">
        <div className="h-2 bg-emerald-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface ReportSummary {
  id: string;
  versionNumber: number;
  elementCounts: Record<string, number>;
  estimatedDurationDays: number;
  workerMix: Array<{ role: string; count: number }>;
}

interface GisReportViewProps {
  fitResult: FitValidationResult | null;
  reportSummary: ReportSummary | null;
  selectedPolygon: any;
  modelDimensions: any;
}

export default function GisReportView({
  fitResult,
  reportSummary,
  selectedPolygon,
  modelDimensions,
}: GisReportViewProps) {
  if (!fitResult) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <FiAlertTriangle className="w-16 h-16 text-muted-foreground/40 mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">No Report Yet</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Validate a model placement first to generate a report.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden p-4">
      {/* Status Header */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {fitResult.fit_status === "valid" ? (
                <FiCheckCircle className="w-5 h-5 text-emerald-500" />
              ) : (
                <FiAlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              <span className="text-sm font-semibold capitalize">
                {fitResult.fit_status === "valid" ? "Valid Fit" : "Needs Adjustment"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Land Area: {fitResult.land_area_sqm.toLocaleString()} sqm
            </p>
          </div>

          {/* Fit Score (gauge) */}
          <div className="text-right flex items-center gap-3">
            <FitGauge value={fitResult.fit_score} />
          </div>
        </div>
      </div>

      {/* Metrics Grid - Placeholder for Phase 3 Charts */}
      <div className="flex-1 overflow-y-auto space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Placeholder cards for charts */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 h-40 flex items-center">
            <div className="w-full">
              <h4 className="text-xs font-semibold mb-2">Fit Overview</h4>
              <div className="flex items-center gap-4">
                <FitGauge value={fitResult.fit_score} />
                <div className="flex-1 space-y-2">
                  <SmallBar label="Utilization" value={fitResult.utilization_ratio * 100} />
                  <SmallBar label="Inside Area" value={Math.min(100, (fitResult.inside_area_sqm / Math.max(1, fitResult.land_area_sqm)) * 100)} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 h-40 flex items-center">
            <div className="w-full">
              <h4 className="text-xs font-semibold mb-2">Environmental & Infrastructure</h4>
              <div className="space-y-2">
                {fitResult.environmental_summary ? (
                  <SmallBar label="Environmental Suitability" value={fitResult.environmental_summary.suitability_score} />
                ) : (
                  <p className="text-xs text-muted-foreground">No environmental metrics available</p>
                )}
                {fitResult.infrastructure_summary ? (
                  <SmallBar label="Infrastructure Readiness" value={fitResult.infrastructure_summary.readiness_score} />
                ) : (
                  <p className="text-xs text-muted-foreground">No infrastructure metrics available</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 h-40 flex items-center justify-center col-span-2">
            <p className="text-xs text-muted-foreground text-center">
              🔀 Sankey Flow<br />
              (Phase 3: Land-use breakdown)
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Placement Metrics
          </h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inside Area:</span>
              <span className="font-mono text-foreground">
                {fitResult.inside_area_sqm.toLocaleString()} sqm
              </span>
            </div>
            {fitResult.overflow_area_sqm > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Overflow Area:</span>
                <span className="font-mono">
                  {fitResult.overflow_area_sqm.toLocaleString()} sqm
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilization:</span>
              <span className="font-mono text-foreground">
                {(fitResult.utilization_ratio * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Suggested Rotation:</span>
              <span className="font-mono text-foreground">
                {fitResult.suggested_rotation_deg}°
              </span>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {fitResult.messages.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <h3 className="text-xs font-semibold text-amber-400 mb-2">Warnings</h3>
            <ul className="space-y-1 text-xs text-amber-300/80">
              {fitResult.messages.slice(0, 3).map((msg: string, idx: number) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-amber-400 flex-none">•</span>
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Report Summary */}
        {reportSummary && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Project Report
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-mono text-foreground">
                  ~{reportSummary.estimatedDurationDays} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recommended Crew:</span>
                <span className="font-mono text-foreground">
                  {reportSummary.workerMix.reduce((sum, w) => sum + w.count, 0)} workers
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="text-[11px] text-muted-foreground/60 border-t border-border pt-3">
        <p>💡 Phase 3 will add interactive gauges, radar charts, heatmaps, and comparison matrices.</p>
      </div>
    </div>
  );
}
