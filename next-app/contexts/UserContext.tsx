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

interface UserState {
  firebaseUid: string | null;
  mongoId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  role: "worker" | "contractor" | null;
  isLoaded: boolean;
}

interface UserContextType {
  user: UserState;
  firebaseUser: FirebaseUser | null;
  clearUser: () => void;
  syncUser: (role?: "worker" | "contractor") => Promise<void>;
  updateUser: (updates: Partial<UserState>) => void;
}

const defaultState: UserState = {
  firebaseUid: null,
  mongoId: null,
  companyName: null,
  firstName: null,
  lastName: null,
  email: null,
  phone: null,
  role: null,
  isLoaded: false,
};

const UserContext = createContext<UserContextType>({
  user: defaultState,
  firebaseUser: null,
  clearUser: () => {},
  syncUser: async () => {},
  updateUser: () => {},
});

const STORAGE_KEY = "buildsync_user";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserState>(defaultState);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const router = useRouter();

  // Log state changes
  useEffect(() => {
    console.log("[UserContext] State updated:", user);
  }, [user]);

  // Persist to localStorage
  useEffect(() => {
    if (user.firebaseUid) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      console.log("[UserContext] Saved to localStorage");
    }
  }, [user]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserState;
        setUser({ ...parsed, isLoaded: false });
        console.log("[UserContext] Loaded from localStorage:", parsed);
      }
    } catch (err) {
      console.error("[UserContext] Failed to load from localStorage:", err);
    }
  }, []);

  const syncUser = useCallback(
    async (role?: "worker" | "contractor") => {
      if (!firebaseUser) return;

      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch("/api/auth/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ role: role || user.role || "worker" }),
        });

        if (!res.ok) {
          throw new Error(`Sync failed: ${res.statusText}`);
        }

        const data = await res.json();
        console.log("[UserContext] Sync response:", data);

        setUser({
          firebaseUid: data.firebaseUid,
          mongoId: data.mongoId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || null,
          companyName: data.companyName || null,
          role: data.role,
          isLoaded: true,
        });

        toast.success("Welcome back!");
      } catch (err) {
        console.error("[UserContext] Sync error:", err);
        toast.error("Authentication failed. Please try again.");
        clearUser();
      }
    },
    [firebaseUser, user.role]
  );

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthLoaded(true);

      if (!fbUser) {
        // User signed out
        setUser({ ...defaultState, isLoaded: true });
        localStorage.removeItem(STORAGE_KEY);
        console.log("[UserContext] Firebase user signed out, cleared state");
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync when firebase user changes
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
    console.log("[UserContext] Clearing user state");
    setUser({ ...defaultState, isLoaded: true });
    localStorage.removeItem(STORAGE_KEY);
    firebaseSignOut(auth).then(() => {
      router.push("/");
    });
  }, [router]);

  const updateUser = useCallback((updates: Partial<UserState>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <UserContext.Provider value={{ user, firebaseUser, clearUser, syncUser, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}

/** Alias for convenience */
export const useUser = useUserContext;
