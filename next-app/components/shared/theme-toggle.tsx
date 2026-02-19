"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";
import { Button } from "@/components/ui/button";

interface ThemeToggleProps {
  fullWidth?: boolean;
}

export function ThemeToggle({ fullWidth = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (fullWidth) {
      return (
        <Button variant="ghost" className="w-full justify-start gap-2" disabled>
          <FiSun className="h-4 w-4" />
          <span>Theme</span>
        </Button>
      );
    }
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled>
        <FiSun className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  if (fullWidth) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start gap-2"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {isDark ? (
          <FiSun className="h-4 w-4" />
        ) : (
          <FiMoon className="h-4 w-4" />
        )}
        <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <FiSun className="h-4 w-4" />
      ) : (
        <FiMoon className="h-4 w-4" />
      )}
    </Button>
  );
}
