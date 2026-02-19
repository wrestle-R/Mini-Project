"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function SSOCallbackPage() {
  const router = useRouter();
  const { user } = useUser();

  useEffect(() => {
    // Wait until user data is synced/loaded before redirecting
    if (user.isLoaded && user.firebaseUid) {
      if (user.role === "contractor") {
        router.push("/contractor/dashboard");
      } else {
        router.push("/dashboard");
      }
    } else if (user.isLoaded && !user.firebaseUid) {
      // Not authenticated, send to login
      router.push("/login");
    }
  }, [user.isLoaded, user.firebaseUid, user.role, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <Skeleton className="h-4 w-32 rounded" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
