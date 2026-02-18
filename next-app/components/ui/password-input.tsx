"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FiEye, FiEyeOff } from "react-icons/fi";

type PasswordInputProps = React.ComponentProps<"input"> & {
  toggleAriaLabel?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, toggleAriaLabel = "Show password", type, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const initialType = type ?? "password";
    const currentType = visible ? "text" : initialType;

    return (
      <div className={cn("relative w-full")} data-slot="password-input">
        <input
          ref={ref}
          type={currentType}
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-10 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            className
          )}
          {...props}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={toggleAriaLabel}
          onClick={() => setVisible((v) => !v)}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md p-0 text-sm cursor-pointer",
            "hover:bg-accent/50 dark:hover:bg-accent/30 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          )}
          data-slot="toggle"
        >
          {visible ? (
            <FiEyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FiEye className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
