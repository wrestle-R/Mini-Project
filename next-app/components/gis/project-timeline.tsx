"use client";

import { motion } from "framer-motion";
import {
  FiChevronRight as ChevronRight,
  FiClock as Clock3,
  FiActivity as Sparkles,
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

export function ProjectTimeline({ phases }: { phases: ProjectTimelinePhase[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Clock3 className="h-4 w-4" />
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Project timeline</span>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#07101a] to-[#071520] p-4 md:p-5">
        <div className="absolute inset-x-8 top-16 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        <div className="flex gap-4 overflow-x-auto px-2 py-6 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-white/10">
          {phases.map((phase, index) => (
            <motion.article
              key={phase.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              className="snap-start min-w-[320px] max-w-[360px] flex-shrink-0 rounded-2xl border border-white/8 bg-white/3 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Phase {phase.sequence}
                  </div>
                  <h3 className="text-base font-semibold text-white">{phase.name}</h3>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                  <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
                    <Clock3 className="h-3.5 w-3.5" />
                    Duration
                  </div>
                  <div className="text-lg font-semibold text-white">{Math.max(1, Math.round(phase.durationDays / 30))} mo</div>
                </div>
              </div>

              <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/6">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(8, phase.durationPercent))}%` }}
                  transition={{ duration: 0.8, delay: 0.15 + index * 0.05 }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-emerald-300"
                />
              </div>

              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Deliverables</p>
              <ul className="mt-2 space-y-1.5 text-sm text-white/75">
                {phase.deliverables.slice(0, 4).map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-xl border border-white/8 bg-black/25 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Key tasks</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {phase.tasks.slice(0, 4).map((task) => (
                    <span key={task} className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                      {task}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {phase.durationPercent.toFixed(1)}% of project
                </span>
                {phase.dependencies.length > 0 && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    Depends on {phase.dependencies.join(", ")}
                  </span>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
}
