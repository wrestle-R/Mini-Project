"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ContractorSidebar } from "@/components/contractor/contractor-sidebar";
import { ContractorTopbar } from "@/components/contractor/contractor-topbar";
import { useContractor } from "@/contexts/ContractorContext";

export default function ContractorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useContractor();
  const router = useRouter();

  useEffect(() => {
    if (user.isLoaded && !user.id) {
      router.replace("/contractor/login");
    }
  }, [user.isLoaded, user.id, router]);

  if (!user.isLoaded) {
    return (
      <div className="theme-contractor flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user.id) return null;

  return (
    <div className="theme-contractor">
      <SidebarProvider>
        <ContractorSidebar />
        <main className="w-full min-h-screen bg-background">
          <ContractorTopbar />
          <div className="p-4 pt-10 md:p-6 md:pt-12 relative">{children}</div>
        </main>
      </SidebarProvider>
    </div>
  );
}
