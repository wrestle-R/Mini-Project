"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface AdminContextType {
  secret: string;
  isAuthenticated: boolean;
  authenticate: (key: string) => void;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType>({
  secret: "",
  isAuthenticated: false,
  authenticate: () => {},
  logout: () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [secret, setSecret] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_secret");
    if (stored) {
      setSecret(stored);
      setIsAuthenticated(true);
    }
  }, []);

  const authenticate = (key: string) => {
    setSecret(key);
    setIsAuthenticated(true);
    sessionStorage.setItem("admin_secret", key);
  };

  const logout = () => {
    setSecret("");
    setIsAuthenticated(false);
    sessionStorage.removeItem("admin_secret");
  };

  return (
    <AdminContext.Provider value={{ secret, isAuthenticated, authenticate, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
