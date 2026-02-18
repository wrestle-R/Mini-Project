export function formatError(err: unknown): string {
  try {
    if (!err) return "An unknown error occurred.";
    if (typeof err === "string") return err;

    if (err instanceof Error) return err.message || String(err);

    const anyErr = err as Record<string, unknown>;
    if (anyErr?.message) return String(anyErr.message);

    // Handle Firebase/API errors with errors array
    if (anyErr?.errors && Array.isArray(anyErr.errors)) {
      const apiErrors = anyErr.errors as Array<{
        message?: string;
        longMessage?: string;
      }>;
      return apiErrors
        .map((e) => e.longMessage || e.message || "Unknown error")
        .join(". ");
    }

    return safeStringify(err);
  } catch {
    return "An error occurred (failed to parse).";
  }
}

function safeStringify(obj: unknown) {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    obj,
    (_key, value) => {
      if (value && typeof value === "object") {
        const asObj = value as object;
        if (seen.has(asObj)) return "[Circular]";
        seen.add(asObj);
      }
      if (typeof value === "function")
        return `[Function ${value.name || "anonymous"}]`;
      return value;
    },
    2
  );
}

export default formatError;
