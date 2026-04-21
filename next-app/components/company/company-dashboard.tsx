"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FiFolder,
  FiUserPlus,
  FiClipboard,
} from "react-icons/fi";

const statCards = [
  { label: "Projects", key: "projects", icon: FiFolder },
  { label: "Contractors", key: "contractors", icon: FiUserPlus },
  { label: "Assignments", key: "assignments", icon: FiClipboard },
] as const;

type StatsState = {
  projects: number;
  contractors: number;
  assignments: number;
};

const DEFAULT_STATS: StatsState = {
  projects: 0,
  contractors: 0,
  assignments: 0,
};

export function CompanyDashboard() {
  const { user, token } = useCompany();
  const [stats, setStats] = useState<StatsState>(DEFAULT_STATS);

  useEffect(() => {
    const fetchStats = async () => {
      if (!token) return;
      try {
        const res = await fetch("/api/dashboard/company/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load stats");
        const data = await res.json();
        setStats({
          projects: Number(data?.stats?.projects ?? 0),
          contractors: Number(data?.stats?.contractors ?? 0),
          assignments: Number(data?.stats?.assignments ?? 0),
        });
      } catch {
        toast.error("Failed to load dashboard stats");
      }
    };

    fetchStats();
  }, [token]);

  if (!user.id) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">
                Welcome back, {user.name || "Company"}
              </CardTitle>
              <Badge variant="secondary">Company</Badge>
            </div>
            <CardDescription>
              Manage your projects, contractors, and assignments.
            </CardDescription>
          </CardHeader>
        </Card>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 * idx }}
          >
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-lg bg-primary/10 p-3">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {stats[stat.key].toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
