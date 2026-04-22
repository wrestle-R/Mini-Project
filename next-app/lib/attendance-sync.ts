import "server-only";

import dbConnect from "@/lib/db";
import Attendance from "@/lib/models/Attendance";
import {
  buildAttendanceExternalKey,
  getPythonApiBase,
  PythonAttendanceRecord,
  PythonAttendanceResponse,
  toAbsoluteFrameUrl,
} from "@/lib/python-attendance";

function normalizeRecord(record: PythonAttendanceRecord) {
  const externalKey = buildAttendanceExternalKey(record);
  const time = record.time ? new Date(record.time) : new Date();
  const livenessObj =
    record && typeof record === "object" && record.liveness && typeof record.liveness === "object"
      ? (record.liveness as { is_alive?: boolean })
      : null;

  return {
    externalKey,
    recognizedId: record.id ?? null,
    recognizedName: record.name ?? "Unknown",
    score: Number(record.score ?? 0),
    status: (record.status === "success" ? "success" : "failure") as
      | "success"
      | "failure",
    reason: record.reason ?? "",
    time,
    source: record.source ?? "",
    frameUrl: toAbsoluteFrameUrl(record.frame_url),
    livenessPassed: Boolean(livenessObj?.is_alive),
    ppe:
      record.ppe && typeof record.ppe === "object"
        ? {
            hard_hat: Boolean(record.ppe.hard_hat),
            vest: Boolean(record.ppe.vest),
            compliant: Boolean(record.ppe.compliant),
          }
        : null,
    diagnostics:
      record.diagnostics && typeof record.diagnostics === "object"
        ? record.diagnostics
        : {},
  };
}

export async function syncAttendanceFromPython(limit = 40) {
  const pythonBase = getPythonApiBase();
  let resp: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      resp = await fetch(`${pythonBase}/attendance?limit=${limit}`, {
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return [];
  }

  if (!resp.ok) {
    return [];
  }

  const payload = (await resp.json()) as PythonAttendanceResponse;
  const records = Array.isArray(payload.records) ? payload.records : [];

  await dbConnect();

  const normalized = records.map(normalizeRecord);
  if (normalized.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (Attendance as any).bulkWrite(
      normalized.map((doc) => ({
        updateOne: {
          filter: { externalKey: doc.externalKey },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  return normalized;
}
