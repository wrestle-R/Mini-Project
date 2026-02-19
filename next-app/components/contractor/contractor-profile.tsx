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
import { Separator } from "@/components/ui/separator";
import { FiMail, FiPhone, FiUser, FiShield } from "react-icons/fi";

export function ContractorProfile() {
  const { user } = useUser();
  const { firstName, lastName, email, phone, firebaseUid } = user;

  if (!firebaseUid) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "—";

  const infoRows = [
    { icon: FiUser, label: "Full Name", value: displayName },
    { icon: FiMail, label: "Email", value: email || "—" },
    { icon: FiPhone, label: "Phone", value: phone || "—" },
    { icon: FiShield, label: "Role", value: "Contractor" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-xl mx-auto"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">Profile</CardTitle>
            <Badge variant="outline">Contractor</Badge>
          </div>
          <CardDescription>Your contractor account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {infoRows.map((row, idx) => (
            <div key={row.label}>
              <div className="flex items-center gap-3 py-2">
                <row.icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {row.value}
                  </p>
                </div>
              </div>
              {idx < infoRows.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
