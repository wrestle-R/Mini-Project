"use client";

import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { AdminProvider, useAdmin } from "@/contexts/AdminContext";
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
import { motion } from "framer-motion";
import { toast } from "sonner";

function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authenticate } = useAdmin();
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!secret.trim()) {
      toast.error("Enter admin secret");
      return;
    }
    setLoading(true);
    // Quick sanity check against the API
    try {
      const res = await fetch("/api/admin/companies", {
        headers: { "x-admin-secret": secret },
      });
      if (res.ok) {
        authenticate(secret);
      } else {
        toast.error("Invalid admin secret");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="theme-admin flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Admin Access</CardTitle>
              <CardDescription>Enter admin secret to continue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="secret">Admin Secret</Label>
                <Input
                  id="secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  placeholder="Enter secret key"
                />
              </div>
              <Button className="w-full" onClick={handleAuth} disabled={loading}>
                {loading ? "Verifying..." : "Access Admin Panel"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="theme-admin">
      <SidebarProvider>
        <AdminSidebar />
        <main className="w-full min-h-screen bg-background">
          <AdminTopbar />
          <div className="p-4 md:p-6 relative">{children}</div>
        </main>
      </SidebarProvider>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <AdminAuthGate>{children}</AdminAuthGate>
    </AdminProvider>
  );
}
