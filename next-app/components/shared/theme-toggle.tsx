"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  fullWidth?: boolean;
  className?: string;
}

export function ThemeToggle({ fullWidth = false, className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (fullWidth) {
      return (
        <Button
          variant="ghost"
          className={cn(
            "h-12 w-full justify-start gap-3 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/55 px-3.5 text-left shadow-sm",
            className
          )}
          disabled
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar/80">
            <FiSun className="h-4 w-4" />
          </span>
          <span className="grid flex-1 text-left leading-none">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Theme
            </span>
            <span className="pt-1 text-sm font-medium">Appearance</span>
          </span>
        </Button>
      );
    }
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        className={cn(
          "h-10 w-10 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/55",
          className
        )}
        disabled
      >
        <FiSun className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  if (fullWidth) {
    return (
      <Button
        variant="ghost"
        className={cn(
          "h-12 w-full justify-start gap-3 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/55 px-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-sidebar-accent hover:shadow-md",
          className
        )}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar/80">
          {isDark ? (
            <FiSun className="h-4 w-4" />
          ) : (
            <FiMoon className="h-4 w-4" />
          )}
        </span>
        <span className="grid flex-1 text-left leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Theme
          </span>
          <span className="pt-1 text-sm font-medium">
            {isDark ? "Switch to Light" : "Switch to Dark"}
          </span>
        </span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className={cn(
        "h-10 w-10 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/55 transition-all duration-200 hover:-translate-y-0.5 hover:bg-sidebar-accent",
        className
      )}
    >
      {isDark ? (
        <FiSun className="h-4 w-4" />
      ) : (
        <FiMoon className="h-4 w-4" />
      )}
    </Button>
  );
}
