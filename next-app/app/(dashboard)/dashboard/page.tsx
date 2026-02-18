"use client";

import { motion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
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
  FiCheckSquare,
  FiClipboard,
  FiUsers,
  FiPackage,
} from "react-icons/fi";

const stats = [
  { label: "Active Tasks", value: "—", icon: FiCheckSquare },
  { label: "Today's DPR", value: "—", icon: FiClipboard },
  { label: "Workers Present", value: "—", icon: FiUsers },
  { label: "Material Orders", value: "—", icon: FiPackage },
];

export default function DashboardPage() {
  const { user } = useUser();
  const { firstName, lastName, role, firebaseUid } = user;

  if (!firebaseUid) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "User";

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
              <Badge variant="secondary" className="capitalize">
                {role || "worker"}
              </Badge>
            </div>
            <CardDescription>
              Here&apos;s an overview of your construction activity today.
            </CardDescription>
          </CardHeader>
        </Card>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
