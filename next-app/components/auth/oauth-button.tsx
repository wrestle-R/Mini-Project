"use client";

import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";

interface OAuthButtonsProps {
  signInWithGoogle: () => void;
}

export function OAuthButtons({ signInWithGoogle }: OAuthButtonsProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full cursor-pointer"
      onClick={signInWithGoogle}
    >
      <FcGoogle className="h-5 w-5 mr-2" />
      Continue with Google
    </Button>
  );
}
