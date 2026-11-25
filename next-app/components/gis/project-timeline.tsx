"use client";

import { motion } from "framer-motion";
import {
  FiChevronRight as ChevronRight,
  FiClock as Clock3,
  FiActivity as Sparkles,
  FiGitMerge as GitMerge,
} from "react-icons/fi";

export type ProjectTimelinePhase = {
  id: string;
  name: string;
  sequence: number;
  durationDays: number;
  durationPercent: number;
  deliverables: string[];
  tasks: string[];
  dependencies: string[];
};

function toMonthsLabel(durationDays: number) {
  return `${Math.max(1, Math.round(durationDays / 30))} mo`;
}

export function ProjectTimeline({ phases }: { phases: ProjectTimelinePhase[] }) {
  if (!phases.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">No timeline data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Clock3 className="h-4 w-4" />
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Project timeline</span>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 md:p-6">
        <div className="pointer-events-none absolute left-8 top-0 h-full w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent md:left-9" />

        <div className="space-y-4">
          {phases.map((phase, index) => {
            const clampedPercent = Math.min(100, Math.max(8, phase.durationPercent));
            return (
              <motion.article
                key={phase.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: index * 0.06 }}
                className="relative rounded-2xl border border-border bg-background/70 p-4 md:p-5"
              >
                <span className="absolute -left-[1.55rem] top-7 hidden h-3.5 w-3.5 rounded-full border-2 border-primary bg-background md:block" />

                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      Phase {phase.sequence}
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{phase.name}</h3>
                  </div>

                  <div className="rounded-xl border border-border bg-card px-3 py-2 text-right">
                    <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Duration
                    </div>
                    <div className="text-lg font-semibold text-foreground">{toMonthsLabel(phase.durationDays)}</div>
                  </div>
                </div>

                <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${clampedPercent}%` }}
                    transition={{ duration: 0.75, delay: 0.15 + index * 0.05 }}
                    className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-primary/70"
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deliverables</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-foreground/90">
                      {phase.deliverables.slice(0, 4).map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Key tasks</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {phase.tasks.slice(0, 4).map((task) => (
                        <span key={task} className="rounded-full border border-border bg-card px-3 py-1 text-[11px] text-foreground/80">
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground">
                    {phase.durationPercent.toFixed(1)}% of project
                  </span>
                  {phase.dependencies.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground">
                      <GitMerge className="h-3 w-3" />
                      Depends on {phase.dependencies.join(", ")}
                    </span>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
