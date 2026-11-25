"use client";

import { forwardRef } from "react";
import type { GisMapHandle } from "@/components/gis/GisMap";
import dynamic from "next/dynamic";

const GisMap = dynamic(() => import("@/components/gis/GisMap"), { ssr: false });

interface GisMapViewProps {
  mapRef: React.RefObject<GisMapHandle | null>;
  onPolygonChange: (polygon: any) => void;
  onModelRotationChange: (rotation: number) => void;
  lockedParcel: any;
  suggestions: any[];
  showSuggestionsPanel: boolean;
  onShowSuggestionsPanel: (show: boolean) => void;
}

export default function GisMapView({
  mapRef,
  onPolygonChange,
  onModelRotationChange,
  lockedParcel,
  suggestions,
  showSuggestionsPanel,
  onShowSuggestionsPanel,
}: GisMapViewProps) {
  return (
    <div className="relative w-full h-full">
      <GisMap
        ref={mapRef}
        onPolygonChange={onPolygonChange}
        onModelRotationChange={onModelRotationChange}
        className="absolute inset-0 rounded-none"
      />

      {/* Map overlay: legend */}
      <div className="absolute bottom-10 left-4 z-10 bg-[#0a0d14]/85 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white/50 space-y-1.5 pointer-events-none">
        <p className="font-semibold text-white/70 mb-1">Confidence</p>
        {[
          { label: "High (≥ 65%)", color: "bg-emerald-500" },
          { label: "Medium (40–65%)", color: "bg-amber-500" },
          { label: "Low (< 40%)", color: "bg-red-500" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-sm ${color} opacity-70`} />
            {label}
          </div>
        ))}
        {lockedParcel && (
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <span className="w-3 h-3 rounded-sm bg-primary opacity-80" />
            Selected parcel
          </div>
        )}
      </div>

      {/* Floating suggestion count badge */}
      {suggestions.length > 0 && !showSuggestionsPanel && (
        <button
          onClick={() => {
            onShowSuggestionsPanel(true);
          }}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-card/90 border border-primary/30
                     rounded-xl px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-all"
        >
          📊 {suggestions.length} suggestions
        </button>
      )}
    </div>
  );
}
