"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ContractorState {
  id: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  photoUrl: string | null;
  companyId: string | null;
  role: "contractor";
  mustChangePassword: boolean;
  isLoaded: boolean;
}

interface ContractorContextType {
  user: ContractorState;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<ContractorState>) => void;
  changePassword: (newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const defaultState: ContractorState = {
  id: null,
  email: null,
  firstName: null,
  lastName: null,
  phone: null,
  photoUrl: null,
  companyId: null,
  role: "contractor",
  mustChangePassword: false,
  isLoaded: false,
};

const ContractorContext = createContext<ContractorContextType>({
  user: defaultState,
  token: null,
  login: async () => {},
  logout: () => {},
  updateUser: () => {},
  changePassword: async () => {},
  refreshUser: async () => {},
});

const STORAGE_KEY = "buildsync_contractor";
const TOKEN_KEY = "buildsync_contractor_token";

export function ContractorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<ContractorState>(defaultState);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY);
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedUser && storedToken) {
        const parsed = JSON.parse(storedUser) as ContractorState;
        setUser({ ...parsed, isLoaded: true });
        setToken(storedToken);
      } else {
        setUser((prev) => ({ ...prev, isLoaded: true }));
      }
    } catch {
      setUser((prev) => ({ ...prev, isLoaded: true }));
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (user.id && token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, token);
    }
  }, [user, token]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/contractor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await res.json();

      setToken(data.token);
      setUser({
        id: data.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        photoUrl: data.photoUrl || null,
        companyId: data.companyId,
        role: "contractor",
        mustChangePassword: data.mustChangePassword,
        isLoaded: true,
      });

      if (data.mustChangePassword) {
        toast.info("Please change your password before continuing.");
        router.push("/contractor/change-password");
      } else {
        toast.success("Welcome back!");
        router.push("/contractor/dashboard");
      }
    },
    [router]
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/auth/contractor/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Password change failed");
      }

      setUser((prev) => ({ ...prev, mustChangePassword: false }));
      toast.success("Password changed successfully!");
      router.push("/contractor/dashboard");
    },
    [token, router]
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch("/api/auth/contractor/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to refresh");
      const data = await res.json();
      setUser({
        id: data.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        photoUrl: data.photoUrl || null,
        companyId: data.companyId,
        role: "contractor",
        mustChangePassword: data.mustChangePassword,
        isLoaded: true,
      });
    } catch {
      logout();
    }
  }, [token]);

  const logout = useCallback(() => {
    setUser({ ...defaultState, isLoaded: true });
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    router.push("/contractor/login");
  }, [router]);

  const updateUser = useCallback((updates: Partial<ContractorState>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <ContractorContext.Provider
      value={{ user, token, login, logout, updateUser, changePassword, refreshUser }}
    >
      {children}
    </ContractorContext.Provider>
  );
}

export function useContractor() {
  const context = useContext(ContractorContext);
  if (!context) {
    throw new Error(
      "useContractor must be used within a ContractorProvider"
    );
  }
  return context;
}
