"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkerSidebar } from "@/components/worker/worker-sidebar";
import { WorkerTopbar } from "@/components/worker/worker-topbar";
import { useWorker } from "@/contexts/WorkerContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, firebaseUser } = useWorker();
  const router = useRouter();

  useEffect(() => {
    if (user.isLoaded && !user.firebaseUid && !firebaseUser) {
      router.replace("/login");
    }
  }, [user.isLoaded, user.firebaseUid, firebaseUser, router]);

  // Keep protected pages in loading state while Firebase auth is ready
  // but WorkerContext sync has not populated the worker profile yet.
  if (!user.isLoaded || (!!firebaseUser && !user.firebaseUid)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user.firebaseUid && !firebaseUser) return null;

  return (
    <SidebarProvider>
      <WorkerSidebar />
      <main className="w-full min-h-screen bg-background">
        <WorkerTopbar />
        <div className="p-4 md:p-6 relative">{children}</div>
      </main>
    </SidebarProvider>
  );
}
