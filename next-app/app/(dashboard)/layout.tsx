import { WorkerDashboardShell } from "@/components/worker/worker-dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkerDashboardShell>{children}</WorkerDashboardShell>;
}
