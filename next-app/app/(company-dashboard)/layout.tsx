"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/company/company-sidebar";
import { CompanyTopbar } from "@/components/company/company-topbar";
import { useCompany } from "@/contexts/CompanyContext";

export default function CompanyDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useCompany();
  const router = useRouter();

  useEffect(() => {
    if (user.isLoaded && !user.id) {
      router.replace("/company/login");
    }
  }, [user.isLoaded, user.id, router]);

  if (!user.isLoaded) {
    return (
      <div className="theme-company flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user.id) return null;

  return (
    <div className="theme-company">
      <SidebarProvider>
        <CompanySidebar />
        <main className="w-full min-h-screen bg-background">
          <CompanyTopbar />
          <div className="p-4 pt-10 md:p-6 md:pt-12 relative">{children}</div>
        </main>
      </SidebarProvider>
    </div>
  );
}
