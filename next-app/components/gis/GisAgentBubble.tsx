"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { FiMessageSquare } from "react-icons/fi";
import type { MapEvent } from "@/components/gis/types";
const GisChat = dynamic(() => import("@/components/gis/GisChat"), { ssr: false });

interface GisAgentBubbleProps {
  open: boolean;
  onClose: () => void;
  selectedPolygonInfo?: { areaSqm: number; centroid: [number, number] } | null;
  onMapEvent: (event: MapEvent) => void;
}

export default function GisAgentBubble({
  open,
  onClose,
  selectedPolygonInfo,
  onMapEvent,
}: GisAgentBubbleProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div aria-hidden={!open}>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => (open ? onClose() : null)}
          aria-label={open ? "Close agent" : "Open agent"}
          className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center text-white"
        >
          <FiMessageSquare className="w-6 h-6" />
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="fixed right-6 bottom-24 z-50 w-[24rem] h-[78vh] max-h-[78vh] rounded-lg bg-card border border-border shadow-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FiMessageSquare className="w-5 h-5 text-primary" />
              <span className="font-semibold">Spatial Agent</span>
            </div>
            <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <GisChat
              onMapEvent={onMapEvent}
              selectedPolygonInfo={selectedPolygonInfo}
            />
          </div>
        </div>
      )}
    </div>
  );
}
