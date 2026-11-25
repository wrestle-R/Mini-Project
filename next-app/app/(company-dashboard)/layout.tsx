import { CompanyDashboardShell } from "@/components/company/company-dashboard-shell";

export default function CompanyDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CompanyDashboardShell>{children}</CompanyDashboardShell>;
}
