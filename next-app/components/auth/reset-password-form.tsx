"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorSuccessMessages } from "@/components/auth/error-success-messages";
import { useResetPassword } from "@/hooks/sign-in/use-reset-password";
import { z } from "zod";
import { FiLoader } from "react-icons/fi";

export function ResetPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { error, successfulCreation, sendCode, setError } =
    useResetPassword();

  const emailSchema = z
    .string()
    .email({ message: "Please enter a valid email address." });

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.issues.map((err) => err.message).join(" "));
      return;
    }
    setIsSubmitting(true);
    await sendCode(email);
    setIsSubmitting(false);
  };

  const allErrors = error
    ? [{ code: "api_error" as const, message: error, longMessage: error, meta: {} }]
    : [];

  return (
    <div className="w-full max-w-sm mx-auto">
      <ErrorSuccessMessages errors={allErrors} />
      {!successfulCreation ? (
        <form onSubmit={handleSendCode} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>
      ) : (
        <div className="text-center text-sm text-muted-foreground">
          <p>A password reset link has been sent to your email.</p>
          <p className="mt-2">Please check your inbox and follow the link to reset your password.</p>
        </div>
      )}
    </div>
  );
}
