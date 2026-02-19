"use client";

import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FiPlus, FiUserPlus, FiCopy } from "react-icons/fi";

interface ContractorItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  mustChangePassword: boolean;
  createdAt: string;
}

export default function CompanyContractorsPage() {
  const { token } = useCompany();
  const [contractors, setContractors] = useState<ContractorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  const fetchContractors = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/contractors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContractors(data.contractors);
      }
    } catch {
      toast.error("Failed to load contractors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractors();
  }, [token]);

  const handleCreate = async () => {
    if (!token || !form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create");
      }
      const data = await res.json();
      setTempPassword(data.tempPassword);
      toast.success("Contractor created! Share the temporary password.");
      setForm({ email: "", firstName: "", lastName: "", phone: "" });
      fetchContractors();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create contractor"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      toast.success("Password copied to clipboard");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contractors</h1>
        <Button onClick={() => { setShowForm(!showForm); setTempPassword(null); }}>
          <FiPlus className="mr-2 h-4 w-4" />
          New Contractor
        </Button>
      </div>

      {tempPassword && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  Temporary Password (share with contractor):
                </p>
                <code className="text-lg font-mono font-bold">
                  {tempPassword}
                </code>
              </div>
              <Button variant="outline" size="sm" onClick={copyPassword}>
                <FiCopy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Create Contractor</CardTitle>
              <CardDescription>
                A temporary password will be auto-generated. Share it with the contractor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="contractor@email.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                  />
                </div>
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
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? "Creating..." : "Create Contractor"}
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {contractors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FiUserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No contractors yet. Create your first contractor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contractors.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <h3 className="font-semibold">
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                        c.email}
                    </h3>
                    <p className="text-sm text-muted-foreground">{c.email}</p>
                    {c.phone && (
                      <p className="text-sm text-muted-foreground">{c.phone}</p>
                    )}
                  </div>
                  <Badge
                    variant={c.mustChangePassword ? "destructive" : "default"}
                  >
                    {c.mustChangePassword ? "Pending Setup" : "Active"}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
