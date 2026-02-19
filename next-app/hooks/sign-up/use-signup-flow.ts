"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  auth,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  googleProvider,
} from "@/lib/firebase";
import { formatError } from "@/hooks/use-error-message";
import { toast } from "sonner";

export function useSignUpHandlers(role: "worker" | "contractor" = "worker") {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = role === "contractor" ? "/contractor/dashboard" : "/dashboard";

  async function signUpWithEmail(
    emailAddress: string,
    password: string,
    firstName: string,
    lastName: string,
    phoneNumber: string
  ) {
    setError("");
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        emailAddress,
        password
      );

      // Update the display name
      const displayName = `${firstName} ${lastName}`.trim();
      await updateProfile(userCredential.user, { displayName });

      // Sync user to MongoDB
      try {
        const idToken = await userCredential.user.getIdToken();
        await fetch("/api/auth/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            role,
            firstName,
            lastName,
            phoneNumber,
          }),
        });
      } catch (syncErr) {
        console.error("[SignUp] MongoDB sync error:", syncErr);
      }

      toast.success("Account created successfully!");
      router.push(redirectTo);
    } catch (err: unknown) {
      const msg = formatError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signUpWithGoogle() {
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);

      // Sync user to MongoDB
      try {
        const idToken = await result.user.getIdToken();
        await fetch("/api/auth/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ role }),
        });
      } catch (syncErr) {
        console.error("[SignUp] MongoDB sync error:", syncErr);
      }

      toast.success("Account created successfully!");
      router.push(redirectTo);
    } catch (err: unknown) {
      const msg = formatError(err);
      setError(msg);
      toast.error(msg);
    }
  }

  return {
    error,
    isSubmitting,
    signUpWithEmail,
    signUpWithGoogle,
    setError,
  };
}
