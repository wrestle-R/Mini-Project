"use client";

import { FiMapPin } from "react-icons/fi";
import GisParticleLoader from "@/components/gis/GisParticleLoader";

interface ModelDimensions {
  width_m: number;
  depth_m: number;
  height_m: number;
  up_axis: "y" | "z";
}

interface FitValidationResult {
  fit_status: "valid" | "partial" | "invalid";
  fit_score: number;
  inside_area_sqm: number;
}

interface SessionSummary {
  id: string;
  title: string;
  currentValidationSnapshotId?: string | null;
}

interface GisRightSidebarProps {
  sessions: SessionSummary[];
  selectedSession: SessionSummary | null;
  onSessionSelect: (sessionId: string) => Promise<void>;
  modelFileName: string | null;
  modelDimensions: ModelDimensions | null;
  onModelFocus: () => void;
  validatingFit: boolean;
  onValidateFit: () => Promise<void>;
  generatingReport: boolean;
  onGenerateReport: () => Promise<void>;
  selectedPolygon: any;
  fitResult: FitValidationResult | null;
  loadingModel: boolean;
  fetchingSessions: boolean;
}

export default function GisRightSidebar({
  sessions,
  selectedSession,
  onSessionSelect,
  modelFileName,
  modelDimensions,
  onModelFocus,
  validatingFit,
  onValidateFit,
  generatingReport,
  onGenerateReport,
  selectedPolygon,
  fitResult,
  loadingModel,
  fetchingSessions,
}: GisRightSidebarProps) {
  return (
    <aside className="flex min-h-0 w-80 flex-none flex-col overflow-hidden border-l border-border bg-card">
      {/* Sticky Model Controls Section */}
      <div className="flex-none sticky top-0 z-10 space-y-2.5 border-b border-border bg-card p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Model Fit Validation
        </p>

        {/* Model Selection */}
        <div className="flex items-center gap-2">
          <select
            suppressHydrationWarning
            style={{ colorScheme: "dark" }}
            className="flex-1 rounded-lg border border-border bg-background px-2 py-2 text-[11px] text-foreground/80 transition-colors hover:bg-muted/40 disabled:opacity-40"
            onChange={(e) => onSessionSelect(e.target.value)}
            disabled={!selectedPolygon || fetchingSessions || loadingModel}
            value={selectedSession?.id || ""}
          >
            <option value="">Select saved 3D model...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          {/* Validate Button with Particle Loader */}
          <button
            onClick={onValidateFit}
            disabled={
              !selectedPolygon || !modelDimensions || validatingFit || loadingModel
            }
            className={`
              flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
              transition-all duration-150 flex-none whitespace-nowrap
              ${
                validatingFit
                  ? "bg-emerald-500/20 border border-emerald-500/35 text-emerald-300"
                  : "bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              }
            `}
          >
            {validatingFit ? (
              <>
                <GisParticleLoader variant="compact" />
                <span>Validating</span>
              </>
            ) : (
              "Validate"
            )}
          </button>
        </div>

        {!selectedPolygon && (
          <p className="text-[10px] text-amber-400/80">
            Please select or draw a land parcel first to load a model.
          </p>
        )}

        {/* Model Info Card */}
        {modelFileName && modelDimensions && (
          <button
            onClick={onModelFocus}
            title="Click to view model location on map"
            className="w-full text-left text-[11px] text-white/55 bg-white/5 border border-white/10 rounded-lg p-2.5 space-y-1 hover:bg-white/10 hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center justify-between">
              <p className="text-white/75 truncate font-medium group-hover:text-primary transition-colors">
                {modelFileName}
              </p>
              <MapPin className="w-3 h-3 text-white/30 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-[10px]">
              {modelDimensions.width_m.toFixed(1)}m × {modelDimensions.depth_m.toFixed(1)}m × {modelDimensions.height_m.toFixed(1)}m
              <span className="text-white/35">
                {" "}
                ({modelDimensions.up_axis.toUpperCase()}-up)
              </span>
            </p>
            <p className="text-[9px] text-primary/60 font-semibold uppercase tracking-wider mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Click to focus on map
            </p>
          </button>
        )}

        {/* Quick Fit Status Card */}
        {fitResult && (
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                Current Status
              </p>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-sm ${
                  fitResult.fit_status === "valid"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {fitResult.fit_status.toUpperCase()}
              </span>
            </div>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Fit Score:</span>
                <span className="font-mono text-foreground font-semibold">
                  {Math.round(fitResult.fit_score * 100)}%
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Area Inside:</span>
                <span className="font-mono text-foreground font-semibold">
                  {fitResult.inside_area_sqm.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}{" "}
                  sqm
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Generate Report Button */}
        <button
          onClick={onGenerateReport}
          disabled={!fitResult || generatingReport}
          className={`
            w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
            transition-all duration-150
            ${
              generatingReport
                ? "bg-primary/20 border border-primary/35 text-primary/80"
                : "bg-primary/20 border border-primary/35 text-primary hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
            }
          `}
        >
          {generatingReport ? (
            <>
              <GisParticleLoader variant="compact" />
              <span>Generating</span>
            </>
          ) : (
            "Generate Report"
          )}
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">Saved parcels and comparisons</p>
            <p>
              This area will surface saved parcels, comparison rankings, and historical insights from the current page state.
            </p>
            <p>
              Use the map or agent to create selections, then save them for side-by-side review here.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

const MapPin = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
