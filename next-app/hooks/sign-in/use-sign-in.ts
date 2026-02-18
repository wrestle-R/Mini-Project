"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  auth,
  signInWithEmailAndPassword,
  signInWithPopup,
  googleProvider,
  sendPasswordResetEmail,
} from "@/lib/firebase";
import { formatError } from "@/hooks/use-error-message";
import { toast } from "sonner";

export interface AuthError {
  code: string;
  message: string;
  longMessage: string;
  meta: Record<string, unknown>;
}

export function useSignInHandlers() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<AuthError[]>();
  const router = useRouter();

  const handleSubmit = async (
    e: React.FormEvent,
    email: string,
    password: string
  ) => {
    e.preventDefault();
    setErrors(undefined);
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Signed in successfully!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = formatError(err);
      setErrors([
        { code: "unknown_error", message: msg, longMessage: msg, meta: {} },
      ]);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setErrors(undefined);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Signed in with Google!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = formatError(err);
      setErrors([
        { code: "oauth_error", message: msg, longMessage: msg, meta: {} },
      ]);
      toast.error(msg);
    }
  };

  const forgotPasswordCode = async (email: string) => {
    setErrors(undefined);
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setErrors([
        {
          code: "success",
          message: "Password reset email sent! Check your inbox.",
          longMessage: "Password reset email sent! Check your inbox.",
          meta: {},
        },
      ]);
      toast.success("Password reset email sent!");
    } catch (err: unknown) {
      const msg = formatError(err);
      setErrors([
        { code: "unknown_error", message: msg, longMessage: msg, meta: {} },
      ]);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    errors,
    handleSubmit,
    signInWithGoogle,
    setErrors,
    forgotPasswordCode,
  };
}
