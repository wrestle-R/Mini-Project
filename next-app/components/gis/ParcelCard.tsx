import { MapPin, Route, Layers, TrendingUp, Lock, CheckCircle2, Navigation } from "lucide-react";
import type { SuggestionItem } from "./types";

const CONFIDENCE_STYLES: Record<
  string,
  { badge: string; bar: string; border: string; glow: string }
> = {
  high: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    bar: "bg-emerald-500",
    border: "border-emerald-500/20",
    glow: "hover:shadow-emerald-500/10",
  },
  medium: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    bar: "bg-amber-500",
    border: "border-amber-500/20",
    glow: "hover:shadow-amber-500/10",
  },
  low: {
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    bar: "bg-red-500",
    border: "border-red-500/20",
    glow: "hover:shadow-red-500/10",
  },
};

interface ParcelCardProps {
  item: SuggestionItem;
  rank: number;
  isLocked?: boolean;
  onLock?: (item: SuggestionItem) => void;
  onFlyTo?: (item: SuggestionItem) => void;
}

export default function ParcelCard({ item, rank, isLocked, onLock, onFlyTo }: ParcelCardProps) {
  const score = item.score ?? 0;
  const normalizedConfidence = (
    item.confidence_label || (score >= 0.65 ? "high" : score >= 0.4 ? "medium" : "low")
  ).toLowerCase();
  const styles = CONFIDENCE_STYLES[normalizedConfidence] ?? CONFIDENCE_STYLES.low;
  const scorePercent = Math.round(score * 100);
  const areaHa = ((item.area_sqm ?? 0) / 10_000).toFixed(2);
  const roadDistance = item.tags?.roadDistance ?? 0;
  const urbanity = item.tags?.urbanity ?? "unknown";

  return (
    <div
      className={`
        group relative bg-white/5 border ${styles.border} rounded-xl p-3.5
        hover:bg-white/8 hover:shadow-lg ${styles.glow} transition-all duration-200
        ${isLocked ? "ring-1 ring-indigo-500/50" : ""}
      `}
    >
      {/* ── Header row ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          {/* Rank badge */}
          <div className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center text-[11px] font-bold text-white/60">
            #{rank}
          </div>
          {/* Score badge */}
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styles.badge}`}
          >
            {normalizedConfidence.toUpperCase()} · {scorePercent}%
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onFlyTo?.(item)}
            title="Fly to location"
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60 transition-all duration-150"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onLock?.(item)}
            title={isLocked ? "Parcel selected" : "Lock this parcel"}
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 flex-none
              ${
                isLocked
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                  : "bg-white/5 text-white/30 hover:bg-indigo-500/20 hover:text-indigo-400"
              }
            `}
          >
            {isLocked ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* ── Score bar ─────────────────────────────────────────────── */}
      <div className="h-1 bg-white/8 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full ${styles.bar} rounded-full transition-all duration-700`}
          style={{ width: `${scorePercent}%` }}
        />
      </div>

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <div className="flex gap-3 text-[10px] text-white/40 mb-2.5">
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3" /> {areaHa} ha
        </span>
        <span className="flex items-center gap-1">
          <Route className="w-3 h-3" />
          {roadDistance < 1000 ? `${Math.round(roadDistance)} m` : `${(roadDistance / 1000).toFixed(1)} km`} {" "}
          to road
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {urbanity}
        </span>
      </div>

      {/* ── Reasons ───────────────────────────────────────────────── */}
      <ul className="space-y-1">
        {(item.reasons || []).slice(0, 2).map((reason, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-white/55 leading-snug">
            <TrendingUp className="w-3 h-3 text-white/20 flex-none mt-0.5" />
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
