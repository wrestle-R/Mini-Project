"use client";

import { FiMap, FiTrendingUp, FiMessageSquare } from "react-icons/fi";

export type GisViewType = "map" | "report" | "agent";

interface GisViewSwitcherProps {
  activeView: GisViewType;
  onViewChange: (view: GisViewType) => void;
  hasReport?: boolean;
}

const VIEWS = [
  {
    id: "map" as const,
    label: "Map View",
    icon: FiMap,
    description: "Interactive map with land selection and model placement",
  },
  {
    id: "report" as const,
    label: "Report",
    icon: FiTrendingUp,
    description: "Detailed analysis with visualizations",
  },
  {
    id: "agent" as const,
    label: "Agent",
    icon: FiMessageSquare,
    description: "Natural language AI assistant",
  },
];

export default function GisViewSwitcher({
  activeView,
  onViewChange,
  hasReport = false,
}: GisViewSwitcherProps) {
  return (
    <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = activeView === view.id;
        const isDisabled = view.id === "report" && !hasReport;

        return (
          <button
            key={view.id}
            onClick={() => !isDisabled && onViewChange(view.id)}
            disabled={isDisabled}
            title={isDisabled ? "Generate a report first" : view.description}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
              transition-all duration-150
              ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : isDisabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
