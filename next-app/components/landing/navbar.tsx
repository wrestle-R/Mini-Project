"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FiLogIn, FiUserPlus, FiSun, FiMoon, FiTool } from "react-icons/fi";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Login", href: "/login", icon: FiLogIn },
  { label: "Sign Up", href: "/signup", icon: FiUserPlus },
];

export function Navbar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FiTool className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-wide">BuildSync</span>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          ))}

          {mounted && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <FiSun className="h-4 w-4" />
              ) : (
                <FiMoon className="h-4 w-4" />
              )}
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
