"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  auth,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface WorkerState {
  firebaseUid: string | null;
  mongoId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  role: "worker";
  isLoaded: boolean;
}

interface WorkerContextType {
  user: WorkerState;
  firebaseUser: FirebaseUser | null;
  clearUser: () => void;
  syncUser: () => Promise<void>;
  updateUser: (updates: Partial<WorkerState>) => void;
}

const defaultState: WorkerState = {
  firebaseUid: null,
  mongoId: null,
  firstName: null,
  lastName: null,
  email: null,
  phone: null,
  photoUrl: null,
  role: "worker",
  isLoaded: false,
};

const WorkerContext = createContext<WorkerContextType>({
  user: defaultState,
  firebaseUser: null,
  clearUser: () => {},
  syncUser: async () => {},
  updateUser: () => {},
});

const STORAGE_KEY = "buildsync_worker";

function splitDisplayName(name?: string | null) {
  const fullName = (name || "").trim();
  if (!fullName) return { firstName: null as string | null, lastName: null as string | null };
  const [first, ...rest] = fullName.split(" ");
  return {
    firstName: first || null,
    lastName: rest.join(" ") || null,
  };
}

export function WorkerProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WorkerState>(defaultState);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const router = useRouter();

  // Persist to localStorage
  useEffect(() => {
    if (user.firebaseUid) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
  }, [user]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WorkerState;
        setUser({ ...parsed, isLoaded: false });
      }
    } catch (err) {
      console.error("[WorkerContext] Failed to load from localStorage:", err);
    }
  }, []);

  const syncUser = useCallback(async () => {
    if (!firebaseUser) return;

    try {
      const idToken = await firebaseUser.getIdToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      let res: Response;
      try {
        res = await fetch("/api/auth/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ role: "worker" }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        throw new Error(`Sync failed: ${res.statusText}`);
      }

      const data = await res.json();

      setUser({
        firebaseUid: data.firebaseUid,
        mongoId: data.mongoId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        photoUrl: data.photoUrl || null,
        role: "worker",
        isLoaded: true,
      });
    } catch (err) {
      console.error("[WorkerContext] Sync error:", err);

      // Degraded mode: keep Firebase-authenticated user logged in even if
      // backend profile sync fails temporarily (e.g., MongoDB DNS timeout).
      const nameFromProfile = splitDisplayName(firebaseUser.displayName);
      setUser((prev) => ({
        firebaseUid: firebaseUser.uid,
        mongoId: prev.mongoId,
        firstName: prev.firstName ?? nameFromProfile.firstName,
        lastName: prev.lastName ?? nameFromProfile.lastName,
        email: prev.email ?? firebaseUser.email ?? null,
        phone: prev.phone,
        photoUrl: prev.photoUrl ?? firebaseUser.photoURL ?? null,
        role: "worker",
        isLoaded: true,
      }));
      toast.error("Profile sync is slow. Opened dashboard in limited mode.");
    }
  }, [firebaseUser]);

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthLoaded(true);

      if (fbUser) {
        const nameFromProfile = splitDisplayName(fbUser.displayName);
        setUser((prev) => ({
          ...prev,
          firebaseUid: fbUser.uid,
          firstName: prev.firstName ?? nameFromProfile.firstName,
          lastName: prev.lastName ?? nameFromProfile.lastName,
          email: prev.email ?? fbUser.email ?? null,
          photoUrl: prev.photoUrl ?? fbUser.photoURL ?? null,
          role: "worker",
          isLoaded: true,
        }));
      } else {
        setUser({ ...defaultState, isLoaded: true });
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-sync when firebase user changes
  useEffect(() => {
    if (authLoaded && firebaseUser) {
      if (!user.mongoId || user.firebaseUid !== firebaseUser.uid) {
        syncUser();
      } else {
        setUser((prev) => ({ ...prev, isLoaded: true }));
      }
    }
  }, [authLoaded, firebaseUser?.uid]);

  const clearUser = useCallback(() => {
    setUser({ ...defaultState, isLoaded: true });
    localStorage.removeItem(STORAGE_KEY);
    firebaseSignOut(auth).then(() => {
      router.push("/login");
    });
  }, [router]);

  const updateUser = useCallback((updates: Partial<WorkerState>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <WorkerContext.Provider
      value={{ user, firebaseUser, clearUser, syncUser, updateUser }}
    >
      {children}
    </WorkerContext.Provider>
  );
}

export function useWorker() {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error("useWorker must be used within a WorkerProvider");
  }
  return context;
}
