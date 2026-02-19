import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkerSidebar } from "@/components/worker/worker-sidebar";
import { WorkerTopbar } from "@/components/worker/worker-topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
