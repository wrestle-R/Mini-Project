"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignInHandlers } from "@/hooks/sign-in/use-sign-in";
import { SignInForm } from "@/components/auth/signin-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion } from "framer-motion";
import { useWorker } from "@/contexts/WorkerContext";

export default function LoginPage() {
  const { user, firebaseUser } = useWorker();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const {
    isSubmitting,
    errors,
    setErrors,
    handleSubmit,
    signInWithGoogle,
    forgotPasswordCode,
  } = useSignInHandlers();

  // Redirect already-authenticated users away from the login page
  useEffect(() => {
    if (user.isLoaded && (user.firebaseUid || firebaseUser)) {
      router.replace("/dashboard");
    }
  }, [user.isLoaded, user.firebaseUid, firebaseUser, router]);

  // Show nothing while we figure out if user is logged in
  if (!user.isLoaded || user.firebaseUid || firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Login to your worker account</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            isSubmitting={isSubmitting}
            errors={errors}
            setErrors={setErrors}
            handleSubmit={handleSubmit}
            signInWithGoogle={signInWithGoogle}
            forgotPasswordCode={forgotPasswordCode}
            signUpUrl="/signup"
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
