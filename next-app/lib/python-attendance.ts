import crypto from "crypto";

export type PythonMatchPpe = {
  hard_hat?: boolean;
  vest?: boolean;
  compliant?: boolean;
};

export type PythonAttendanceRecord = {
  id?: string | null;
  name?: string;
  score?: number;
  status?: "success" | "failure";
  reason?: string;
  time?: string;
  source?: string;
  diagnostics?: Record<string, unknown>;
  ppe?: PythonMatchPpe;
  frame_url?: string;
  liveness?: {
    is_alive?: boolean;
    details?: Record<string, unknown>;
  };
};

export type PythonAttendanceResponse = {
  count?: number;
  records?: PythonAttendanceRecord[];
};

export function getPythonApiBase() {
  return process.env.PYTHON_API_BASE_URL || "http://localhost:8000";
}

export function buildAttendanceExternalKey(record: PythonAttendanceRecord) {
  const keySource = JSON.stringify({
    id: record.id ?? null,
    name: record.name ?? "Unknown",
    score: Number(record.score ?? 0).toFixed(6),
    status: record.status ?? "failure",
    reason: record.reason ?? "",
    time: record.time ?? "",
    source: record.source ?? "",
    frame_url: record.frame_url ?? "",
  });

  return crypto.createHash("sha1").update(keySource).digest("hex");
}

export function toAbsoluteFrameUrl(frameUrl?: string) {
  if (!frameUrl) return "";
  if (frameUrl.startsWith("http://") || frameUrl.startsWith("https://")) {
    return frameUrl;
  }

  const base = getPythonApiBase().replace(/\/$/, "");
  const path = frameUrl.startsWith("/") ? frameUrl : `/${frameUrl}`;
  return `${base}${path}`;
}
