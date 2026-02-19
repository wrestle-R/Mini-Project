import { SidebarProvider } from "@/components/ui/sidebar";
import { ContractorSidebar } from "@/components/contractor/contractor-sidebar";
import { ContractorTopbar } from "@/components/contractor/contractor-topbar";

export default function ContractorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <ContractorSidebar />
      <main className="w-full min-h-screen bg-background">
        <ContractorTopbar />
        <div className="p-4 md:p-6 relative">{children}</div>
      </main>
    </SidebarProvider>
  );
}
