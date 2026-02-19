"use client";

import { motion } from "framer-motion";
import { useContractor } from "@/contexts/ContractorContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FiFolder,
  FiCheckSquare,
  FiClipboard,
  FiUsers,
  FiPackage,
  FiFileText,
} from "react-icons/fi";

const stats = [
  { label: "Active Projects", value: "—", icon: FiFolder },
  { label: "Open Tasks", value: "—", icon: FiCheckSquare },
  { label: "Today's DPR", value: "—", icon: FiClipboard },
  { label: "Workers on Site", value: "—", icon: FiUsers },
  { label: "Material Orders", value: "—", icon: FiPackage },
  { label: "Pending Invoices", value: "—", icon: FiFileText },
];

export function ContractorDashboard() {
  const { user } = useContractor();
  const firstName = user.firstName;
  const lastName = user.lastName;
  const id = user.id;

  if (!id) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Contractor";

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
                Welcome back, {displayName}
              </CardTitle>
              <Badge variant="secondary">Contractor</Badge>
            </div>
            <CardDescription>
              Here&apos;s an overview of your projects and operations today.
            </CardDescription>
          </CardHeader>
        </Card>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, idx) => (
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
                    {stat.value}
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
