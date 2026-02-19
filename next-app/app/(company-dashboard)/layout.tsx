import { SidebarProvider } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/company/company-sidebar";
import { CompanyTopbar } from "@/components/company/company-topbar";

export default function CompanyDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <CompanySidebar />
      <main className="w-full min-h-screen bg-background">
        <CompanyTopbar />
        <div className="p-4 md:p-6 relative">{children}</div>
      </main>
    </SidebarProvider>
  );
}
