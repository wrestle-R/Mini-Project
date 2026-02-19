"use client";

import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  FiMail,
  FiPhone,
  FiUser,
  FiShield,
  FiEdit2,
  FiSave,
  FiX,
  FiBriefcase,
} from "react-icons/fi";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/shared/avatar-upload";

export function CompanyProfile() {
  const { user, token, updateUser } = useCompany();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
    sector: user.sector || "",
  });

  if (!user.id) {
    return (
      <div className="w-full space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const handleEdit = () => {
    setForm({
      name: user.name || "",
      phone: user.phone || "",
      sector: user.sector || "",
    });
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile/company", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      updateUser({
        name: data.name,
        phone: data.phone,
        sector: data.sector,
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
              <CardTitle className="text-2xl">Company Profile</CardTitle>
              <Badge variant="secondary">Company</Badge>
            </div>
            {!editing && (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <FiEdit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
          <CardDescription>
            Manage your company details
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Company logo */}
          <div className="flex items-center gap-4">
            <AvatarUpload
              currentUrl={user.logoUrl}
              fallbackInitial={(user.name?.[0] || "C").toUpperCase()}
              role="company"
              token={token}
              onUploaded={(url) => updateUser({ logoUrl: url })}
              size={72}
            />
            <div>
              <p className="font-semibold text-lg">{user.name || "—"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Separator />

          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  value={form.sector}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sector: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  <FiSave className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="ghost" onClick={handleCancel}>
                  <FiX className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <FiBriefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Company Name:</span>
                <span className="font-medium">{user.name || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FiMail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user.email || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FiPhone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{user.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FiShield className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Sector:</span>
                <span className="font-medium">{user.sector || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FiUser className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Role:</span>
                <Badge variant="outline">Company</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
