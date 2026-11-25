"use client";

import dynamic from "next/dynamic";
import ParcelCard from "@/components/gis/ParcelCard";
import type { MapEvent, SuggestionItem } from "@/components/gis/types";

const GisChat = dynamic(() => import("@/components/gis/GisChat"), { ssr: false });

interface GisAgentViewProps {
  selectedPolygon: any;
  onPolygonChange: (polygon: any) => void;
  onMapEvent: (event: MapEvent) => void;
  suggestions: SuggestionItem[];
  onSuggestionsUpdate: (suggestions: SuggestionItem[]) => void;
  lockedParcel: SuggestionItem | null;
  onLockParcel: (item: SuggestionItem) => void;
  onFlyTo: (item: SuggestionItem) => void;
}

export default function GisAgentView({
  selectedPolygon,
  onPolygonChange,
  onMapEvent,
  suggestions,
  onSuggestionsUpdate,
  lockedParcel,
  onLockParcel,
  onFlyTo,
}: GisAgentViewProps) {
  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden p-4">
      {/* Chat Section */}
      <div className="flex-1 min-h-0 rounded-lg border border-border bg-muted/30 overflow-hidden">
        <GisChat
          onMapEvent={onMapEvent}
          selectedPolygonInfo={
            selectedPolygon
              ? { areaSqm: selectedPolygon.areaSqm, centroid: selectedPolygon.centroid }
              : null
          }
        />
      </div>

      {/* Parcels/Suggestions Section */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto space-y-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground px-2">
            Suggestions ({suggestions.length})
          </h3>
          {suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 px-2">
              Ask the agent to find land, or draw a polygon on the map.
            </p>
          ) : (
            <div className="space-y-2 px-2">
              {suggestions.slice(0, 5).map((item, idx) => (
                <ParcelCard
                  key={item.id}
                  rank={idx + 1}
                  item={item}
                  isLocked={lockedParcel?.id === item.id}
                  onLock={() => onLockParcel(item)}
                  onFlyTo={() => onFlyTo(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
