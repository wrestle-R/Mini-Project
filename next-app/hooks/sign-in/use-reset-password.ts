"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  auth,
  sendPasswordResetEmail,
} from "@/lib/firebase";
import { formatError } from "@/hooks/use-error-message";
import { toast } from "sonner";

export function useResetPassword() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [successfulCreation, setSuccessfulCreation] = useState(false);

  async function sendCode(email: string) {
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessfulCreation(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err: unknown) {
      const msg = formatError(err);
      setError(msg);
      toast.error(msg);
    }
  }

  return {
    error,
    successfulCreation,
    sendCode,
    setError,
  };
}
