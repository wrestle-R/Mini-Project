export type WorkerSession = {
  firebaseUid: string | null;
  mongoId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  role: 'worker';
};

export type WorkerStats = {
  openOpportunities: number;
  pendingApplications: number;
  acceptedProjects: number;
  currentAssignments: number;
};

export type ProjectLocation = {
  displayName: string;
  lat: number | null;
  lng: number | null;
};

export type DashboardMapProject = {
  id: string;
  title: string;
  status: string;
  timeline: 'current' | 'past';
  location: ProjectLocation;
};

export type DashboardStatsResponse = {
  stats: WorkerStats;
  mapProjects: DashboardMapProject[];
};

export type WorkerProjectItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  location: ProjectLocation;
  budget: number;
  isOpen: boolean;
  startDate: string | null;
  endDate: string | null;
  company: { name: string; sector: string } | null;
  applicationStatus: 'pending' | 'accepted' | 'rejected' | null;
  appliedAt: string | null;
  createdAt: string;
};

export type WorkerProjectsResponse = {
  projects: WorkerProjectItem[];
};

export type WorkerAttendanceRow = {
  id: string;
  date: string;
  projectTitle: string;
  status: string;
  checkIn: string;
  checkOut: string;
};

export type WorkerAttendanceResponse = {
  attendance: WorkerAttendanceRow[];
};

export type MinimalWorkerProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  photoUrl: string | null;
};

export type MobileThemePreference = 'system' | 'light' | 'dark';

export type LanguagePreference = 'en' | 'hi' | 'mr';

export type WorkerDailyReport = {
  id: string;
  project: { id: string; title: string; status: string } | null;
  requesterName: string;
  requesterRole: string;
  reportDate: string;
  workSummary: string;
  manpowerCount: number;
  materialsUsed: string;
  blockers: string;
  nextDayPlan: string;
  notes: string;
  createdAt: string;
};

export type WorkerDailyReportsResponse = {
  reports: WorkerDailyReport[];
  projects: { id: string; title: string; status: string }[];
};

export type CreateDailyReportPayload = {
  projectId: string;
  reportDate: string;
  workSummary: string;
  manpowerCount: string;
  materialsUsed: string;
  blockers: string;
  nextDayPlan: string;
  notes: string;
};
