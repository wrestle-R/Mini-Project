"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAuthButtons } from "@/components/auth/oauth-button";
import { ErrorSuccessMessages } from "@/components/auth/error-success-messages";
import { PasswordInput } from "@/components/ui/password-input";
import { z } from "zod";
import { AuthError } from "@/hooks/sign-in/use-sign-in";
import Link from "next/link";
import { FiLoader } from "react-icons/fi";

interface SignInFormProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  isSubmitting: boolean;
  errors?: AuthError[];
  setErrors?: (errors?: AuthError[] | undefined) => void;
  handleSubmit: (e: React.FormEvent, email: string, password: string) => void;
  signInWithGoogle: () => void;
  forgotPasswordCode: (email: string) => void;
  signUpUrl?: string;
}

export function SignInForm({
  email,
  setEmail,
  password,
  setPassword,
  isSubmitting,
  errors,
  setErrors,
  handleSubmit,
  signInWithGoogle,
  forgotPasswordCode,
  signUpUrl = "/signup",
}: SignInFormProps) {
  const loginSchema = z.object({
    email: z.string().email({ message: "Please enter a valid email address." }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters." }),
  });
  const emailSchema = z
    .string()
    .email({ message: "Please enter a valid email address." });

  const handleValidatedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (setErrors) setErrors(undefined);
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      if (setErrors) {
        setErrors(
          result.error.issues.map((err) => ({
            code: "validation_error",
            message: err.message,
            longMessage: err.message,
            meta: {},
          }))
        );
      }
      return;
    }
    handleSubmit(e, email, password);
  };

  const handleForgotPassword = () => {
    if (setErrors) setErrors(undefined);
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      if (setErrors) {
        setErrors(
          result.error.issues.map((err) => ({
            code: "validation_error",
            message: err.message,
            longMessage: err.message,
            meta: {},
          }))
        );
      }
      return;
    }
    forgotPasswordCode(email);
  };

  return (
    <form onSubmit={handleValidatedSubmit}>
      <ErrorSuccessMessages errors={errors} />
      <div className="flex flex-col gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              className="ml-auto inline-block text-sm underline-offset-4 hover:underline text-primary bg-transparent border-none p-0 cursor-pointer"
              onClick={handleForgotPassword}
            >
              Forgot your password?
            </button>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full flex items-center justify-center gap-2 cursor-pointer"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              "Login"
            )}
          </Button>
          <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
            <span className="bg-card text-muted-foreground relative z-10 px-2">
              Or continue with
            </span>
          </div>
          <OAuthButtons signInWithGoogle={signInWithGoogle} />
        </div>
      </div>
      <div className="mt-4 text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href={signUpUrl} className="underline underline-offset-4 text-primary">
          Sign up
        </Link>
      </div>
    </form>
  );
}
