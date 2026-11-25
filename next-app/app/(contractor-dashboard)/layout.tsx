import { ContractorDashboardShell } from "@/components/contractor/contractor-dashboard-shell";

export default function ContractorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ContractorDashboardShell>{children}</ContractorDashboardShell>;
}
