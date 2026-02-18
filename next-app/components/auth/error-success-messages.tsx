"use client";

import React from "react";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";

export interface AuthError {
  code: string;
  message: string;
  longMessage: string;
  meta: Record<string, unknown>;
}

export function ErrorSuccessMessages({
  errors,
}: {
  errors?: AuthError[];
}) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="mb-4">
      {errors.map((err, idx) =>
        err.code === "success" ? (
          <div
            key={idx}
            className="flex items-center gap-2 rounded-md bg-secondary border border-border text-foreground px-3 py-2 text-sm mb-2"
          >
            <FiCheckCircle className="h-4 w-4 text-primary" />
            <span>{err.message}</span>
          </div>
        ) : (
          <div
            key={idx}
            className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2 text-sm mb-2"
          >
            <FiAlertCircle className="h-4 w-4" />
            <span>{err.message}</span>
          </div>
        )
      )}
    </div>
  );
}
