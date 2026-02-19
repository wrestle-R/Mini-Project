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

interface CompanyState {
  id: string | null;
  email: string | null;
  name: string | null;
  sector: string | null;
  phone: string | null;
  logoUrl: string | null;
  role: "company";
  mustChangePassword: boolean;
  isLoaded: boolean;
}

interface CompanyContextType {
  user: CompanyState;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<CompanyState>) => void;
  changePassword: (newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const defaultState: CompanyState = {
  id: null,
  email: null,
  name: null,
  sector: null,
  phone: null,
  logoUrl: null,
  role: "company",
  mustChangePassword: false,
  isLoaded: false,
};

const CompanyContext = createContext<CompanyContextType>({
  user: defaultState,
  token: null,
  login: async () => {},
  logout: () => {},
  updateUser: () => {},
  changePassword: async () => {},
  refreshUser: async () => {},
});

const STORAGE_KEY = "buildsync_company";
const TOKEN_KEY = "buildsync_company_token";

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CompanyState>(defaultState);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY);
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedUser && storedToken) {
        const parsed = JSON.parse(storedUser) as CompanyState;
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
      const res = await fetch("/api/auth/company/login", {
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
        name: data.name,
        sector: data.sector,
        phone: data.phone,
        logoUrl: data.logoUrl || null,
        role: "company",
        mustChangePassword: data.mustChangePassword,
        isLoaded: true,
      });

      if (data.mustChangePassword) {
        toast.info("Please change your password before continuing.");
        router.push("/company/change-password");
      } else {
        toast.success("Welcome back!");
        router.push("/company/dashboard");
      }
    },
    [router]
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/auth/company/change-password", {
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
      router.push("/company/dashboard");
    },
    [token, router]
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch("/api/auth/company/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to refresh");
      const data = await res.json();
      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        sector: data.sector,
        phone: data.phone,
        logoUrl: data.logoUrl || null,
        role: "company",
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
    router.push("/company/login");
  }, [router]);

  const updateUser = useCallback((updates: Partial<CompanyState>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <CompanyContext.Provider
      value={{ user, token, login, logout, updateUser, changePassword, refreshUser }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
