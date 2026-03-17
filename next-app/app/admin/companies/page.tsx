"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  email: string;
  sector: string;
}

export default function AdminCompaniesPage() {
  const { secret } = useAdmin();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/companies", {
        headers: { "x-admin-secret": secret },
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      } else {
        toast.error("Failed to fetch companies");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    if (secret) fetchCompanies();
  }, [secret, fetchCompanies]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All registered companies on the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCompanies}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/companies/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Company
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Companies ({loading ? "..." : companies.length})</CardTitle>
          <CardDescription>List of all companies created by admin</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No companies yet.</p>
              <Button size="sm" className="mt-4" asChild>
                <Link href="/admin/companies/create">Create your first company</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </div>
                  {c.sector && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      {c.sector}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
