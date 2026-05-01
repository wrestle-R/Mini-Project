import type {
  WorkerAttendanceResponse,
  DashboardStatsResponse,
  WorkerProjectsResponse,
  WorkerSession,
} from '@/lib/types';

const API_BASE_URL = 'https://buildsync-crce.vercel.app';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT';
  token?: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const message = (payload as { error?: string }).error ?? 'Request failed';
      throw new ApiError(message, res.status);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncWorkerAuth(token: string): Promise<WorkerSession> {
  const data = await request<WorkerSession>('/api/auth/sync', {
    method: 'POST',
    token,
    body: { role: 'worker' },
  });

  return {
    firebaseUid: data.firebaseUid,
    mongoId: data.mongoId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    photoUrl: data.photoUrl,
    role: 'worker',
  };
}

export function getWorkerDashboardStats(token: string) {
  return request<DashboardStatsResponse>('/api/dashboard/worker/stats', { token });
}

export function getWorkerProjects(token: string) {
  return request<WorkerProjectsResponse>('/api/worker/projects', { token });
}

export function getWorkerAttendance(token: string) {
  return request<WorkerAttendanceResponse>('/api/worker/attendance', { token });
}

export function applyToWorkerProject(token: string, projectId: string, message: string) {
  return request('/api/worker/projects', {
    method: 'POST',
    token,
    body: { projectId, message },
  });
}

export function updateWorkerProfileBasic(
  token: string,
  payload: { firstName: string; lastName: string; phone: string }
) {
  return request<WorkerSession>('/api/profile', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function getWorkerProfileExtended(token: string) {
  return request<Record<string, unknown>>('/api/profile/extended', { token });
}

export { ApiError, API_BASE_URL };
