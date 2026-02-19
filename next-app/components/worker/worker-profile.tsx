"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useWorker } from "@/contexts/WorkerContext";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FiMail, FiPhone, FiUser, FiShield, FiEdit2, FiSave, FiX } from "react-icons/fi";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/shared/avatar-upload";

export function WorkerProfile() {
  const { user, updateUser, firebaseUser } = useWorker();
  const { firstName, lastName, email, phone, photoUrl, firebaseUid } = user;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: firstName || "",
    lastName: lastName || "",
    phone: phone || "",
  });

  // Keep firebase token fresh for uploads
  useEffect(() => {
    if (firebaseUser) {
      firebaseUser.getIdToken().then(setFirebaseToken);
    }
  }, [firebaseUser]);

  if (!firebaseUid) {
    return (
      <div className="w-full space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "—";

  const handleEdit = () => {
    setForm({
      firstName: firstName || "",
      lastName: lastName || "",
      phone: phone || "",
    });
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      updateUser({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      });
      toast.success("Profile updated successfully!");
      setEditing(false);
    } catch {
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">Profile</CardTitle>
              <Badge variant="outline">Worker</Badge>
            </div>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <FiEdit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                  <FiX className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <FiSave className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
          <CardDescription>Your worker account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar / display name row */}
          <div className="flex items-center gap-4">
            <AvatarUpload
              currentUrl={photoUrl}
              fallbackInitial={(firstName?.[0] || "?").toUpperCase()}
              role="worker"
              token={firebaseToken}
              onUploaded={(url) => updateUser({ photoUrl: url })}
              size={56}
            />
            <div>
              <p className="font-semibold text-lg">{displayName}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>

          <Separator />

          {/* Fields */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* First Name */}
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                <FiUser className="h-3 w-3" /> First Name
              </Label>
              {editing ? (
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="First name"
                />
              ) : (
                <p className="text-sm font-medium">{firstName || "—"}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                <FiUser className="h-3 w-3" /> Last Name
              </Label>
              {editing ? (
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Last name"
                />
              ) : (
                <p className="text-sm font-medium">{lastName || "—"}</p>
              )}
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                <FiMail className="h-3 w-3" /> Email
              </Label>
              <p className="text-sm font-medium text-muted-foreground">{email || "—"}</p>
              <p className="text-xs text-muted-foreground/70">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                <FiPhone className="h-3 w-3" /> Phone Number
              </Label>
              {editing ? (
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                />
              ) : (
                <p className="text-sm font-medium">{phone || "—"}</p>
              )}
            </div>

            {/* Role (read-only) */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                <FiShield className="h-3 w-3" /> Role
              </Label>
              <Badge variant="secondary">Worker</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
