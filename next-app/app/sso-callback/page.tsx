"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorker } from "@/contexts/WorkerContext";

export default function SSOCallbackPage() {
  const router = useRouter();
  const { user } = useWorker();

  useEffect(() => {
    if (user.isLoaded && user.firebaseUid) {
      router.replace("/dashboard");
    } else if (user.isLoaded && !user.firebaseUid) {
      router.replace("/login");
    }
  }, [user.isLoaded, user.firebaseUid, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Completing sign in…</p>
      </div>
    </div>
  );
}
