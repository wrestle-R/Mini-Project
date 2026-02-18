"use client";

import { SignUpForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion } from "framer-motion";

export default function ContractorSignUpPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Contractor Sign Up</CardTitle>
          <CardDescription>
            Create a contractor account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm userType="contractor" signInUrl="/contractor/login" />
        </CardContent>
      </Card>
    </motion.div>
  );
}
