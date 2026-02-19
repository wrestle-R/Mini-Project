"use client";

import { useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { useRouter } from "next/navigation";
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
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function CreateCompanyPage() {
  const { secret } = useAdmin();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    sector: "",
  });

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.name) {
      toast.error("Email, password, and company name are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create");
      }
      toast.success("Company created successfully!");
      router.push("/admin/companies");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create company"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/companies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Company</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create a new company account. They will be prompted to change their
            password on first login.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>
            Fill in the details for the new company account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comp-name">Company Name *</Label>
              <Input
                id="comp-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-sector">Sector</Label>
              <Input
                id="comp-sector"
                value={form.sector}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sector: e.target.value }))
                }
                placeholder="Construction, Real Estate..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comp-email">Email *</Label>
              <Input
                id="comp-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="company@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-password">Password *</Label>
              <Input
                id="comp-password"
                type="text"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="Temporary password"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating..." : "Create Company"}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/companies">Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
