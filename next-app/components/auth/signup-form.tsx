"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorSuccessMessages } from "@/components/auth/error-success-messages";
import { useSignUpHandlers } from "@/hooks/sign-up/use-signup-flow";
import { OAuthButtons } from "@/components/auth/oauth-button";
import { PasswordInput } from "@/components/ui/password-input";
import { z } from "zod";
import Link from "next/link";
import { FiLoader } from "react-icons/fi";

interface SignUpFormProps {
  userType: "worker" | "contractor";
  signInUrl?: string;
}

export function SignUpForm({
  userType,
  signInUrl = "/login",
}: SignUpFormProps) {
  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const { error, isSubmitting, signUpWithEmail, signUpWithGoogle, setError } =
    useSignUpHandlers(userType);

  const signupSchema = z.object({
    emailAddress: z
      .string()
      .email({ message: "Please enter a valid email address." }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters." }),
    firstName: z
      .string()
      .min(1, { message: "First name is required." }),
    lastName: z
      .string()
      .min(1, { message: "Last name is required." }),
    phoneNumber: z
      .string()
      .min(10, { message: "Please enter a valid phone number." }),
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = signupSchema.safeParse({
      emailAddress,
      password,
      firstName,
      lastName,
      phoneNumber,
    });
    if (!result.success) {
      const message = result.error.issues.map((err) => err.message).join(" ");
      setError(message);
      return;
    }

    await signUpWithEmail(emailAddress, password, firstName, lastName, phoneNumber);
  };

  const allErrors = error
    ? [{ code: "api_error" as const, message: error, longMessage: error, meta: {} }]
    : [];

  return (
    <div className="w-full max-w-sm mx-auto">
      <ErrorSuccessMessages errors={allErrors} />
      <form onSubmit={handleSignUp} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              type="text"
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            type="tel"
            placeholder="+91 9876543210"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="emailAddress">Email</Label>
          <Input
            id="emailAddress"
            type="email"
            placeholder="john@example.com"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            onChange={(e) => setPassword(e.target.value)}
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
            "Sign Up"
          )}
        </Button>
        <div className="flex flex-col gap-3 mt-2">
          <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
            <span className="bg-card text-muted-foreground relative z-10 px-2">
              Or continue with
            </span>
          </div>
          <OAuthButtons signInWithGoogle={signUpWithGoogle} />
        </div>
        <div className="mt-2 text-center text-sm">
          Already have an account?{" "}
          <Link
            href={signInUrl}
            className="underline underline-offset-4 text-primary"
          >
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
