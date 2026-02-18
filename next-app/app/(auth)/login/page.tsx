"use client";

import { useState } from "react";
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

export default function LoginPage() {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Login to your worker account
          </CardDescription>
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
