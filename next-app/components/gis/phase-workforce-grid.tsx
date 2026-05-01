"use client";

import { motion } from "framer-motion";
import { HardHat, ShieldCheck, Users } from "lucide-react";

export type PhaseWorker = {
  role: string;
  title: string;
  category: string;
  quantity: number;
  phaseId: string;
  phaseName: string;
  duration: string;
  responsibilities: string[];
};

export type PhaseWorkforce = {
  phaseId: string;
  phaseName: string;
  sequence: number;
  workers: PhaseWorker[];
  totalCrew: number;
  peakCrew: number;
};

function categoryTone(category: string) {
  switch (category) {
    case "engineering":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-100";
    case "specialized":
      return "border-violet-500/20 bg-violet-500/10 text-violet-100";
    case "management":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-100";
  }
}

export function PhaseWorkforceGrid({ phases }: { phases: PhaseWorkforce[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-amber-300">
        <Users className="h-4 w-4" />
        <span className="text-xs uppercase tracking-[0.2em] text-white/45">Workforce by phase</span>
      </div>

      <div className="grid gap-4">
        {phases.map((phase, index) => (
          <motion.section
            key={phase.phaseId}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.06 }}
            className="rounded-3xl border border-white/10 bg-[#0b111d] p-4 md:p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Phase {phase.sequence}</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{phase.phaseName}</h3>
              </div>
              <div className="flex gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                  <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
                    <HardHat className="h-3.5 w-3.5" />
                    Total crew
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">{phase.totalCrew}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                  <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Peak
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">{phase.peakCrew}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {phase.workers.map((worker) => (
                <div key={`${phase.phaseId}-${worker.role}`} className={`rounded-2xl border p-4 ${categoryTone(worker.category)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{worker.title}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/65">{worker.category}</p>
                    </div>
                    <span className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-sm font-semibold text-white">
                      {worker.quantity}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-white/80">{worker.responsibilities.join(" · ")}</p>
                </div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
