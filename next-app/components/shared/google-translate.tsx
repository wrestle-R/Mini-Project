"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

declare global {
  interface Window {
    googleTranslateElementInit2?: () => void;
    google?: {
      translate?: {
        TranslateElement?: new (
          options: Record<string, unknown>,
          elementId: string
        ) => unknown;
      };
    };
  }
}

type SelectorVariant = "navbar" | "sidebar";

type GoogleTranslateLanguageSelectorProps = {
  variant?: SelectorVariant;
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
};

const INCLUDED_LANGUAGES = "en,hi,mr,bn,gu,ta,te,kn,ml,pa,ur,or,as";
const COOKIE_NAME = "googtrans";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "bn", label: "Bengali" },
  { code: "gu", label: "Gujarati" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "pa", label: "Punjabi" },
  { code: "ur", label: "Urdu" },
  { code: "or", label: "Odia" },
  { code: "as", label: "Assamese" },
];

let isScriptLoaded = false;
let isScriptLoading = false;
let scriptLoadPromise: Promise<void> | null = null;

function readCurrentLanguageFromCookie() {
  if (typeof document === "undefined") return "en";

  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) return "en";

  const cookieValue = decodeURIComponent(cookie.split("=")[1] || "");
  const segments = cookieValue.split("/").filter(Boolean);
  const targetLanguage = segments[1] || "en";

  return LANGUAGE_OPTIONS.some((option) => option.code === targetLanguage)
    ? targetLanguage
    : "en";
}

function setGoogleTranslateCookie(languageCode: string) {
  const nextValue = `/en/${languageCode}`;
  document.cookie = `${COOKIE_NAME}=${nextValue};path=/`;
  document.cookie = `${COOKIE_NAME}=${nextValue};path=/;domain=${window.location.hostname}`;
}

function triggerGoogleTranslateCombo(languageCode: string) {
  const combo = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;

  if (!combo) return false;

  combo.value = languageCode;
  combo.dispatchEvent(new Event("change"));
  return true;
}

function loadGoogleTranslateScript() {
  if (isScriptLoading && scriptLoadPromise) {
    return scriptLoadPromise;
  }

  if (isScriptLoaded) {
    window.googleTranslateElementInit2?.();
    return Promise.resolve();
  }

  isScriptLoading = true;

  scriptLoadPromise = new Promise((resolve) => {
    const existingScript = document.getElementById("google-translate-script-loader");
    if (existingScript) {
      isScriptLoading = false;
      isScriptLoaded = true;
      window.googleTranslateElementInit2?.();
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit2";
    script.async = true;
    script.defer = true;
    script.id = "google-translate-script-loader";

    script.onload = () => {
      isScriptLoaded = true;
      isScriptLoading = false;
      resolve();
    };

    script.onerror = () => {
      isScriptLoading = false;
      resolve();
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export function GoogleTranslateProvider() {
  useEffect(() => {
    window.googleTranslateElementInit2 = () => {
      try {
        if (window.google?.translate?.TranslateElement) {
          const existingWrapper = document.getElementById("google_translate_element");
          if (existingWrapper && existingWrapper.childElementCount === 0) {
            new window.google.translate.TranslateElement(
              {
                pageLanguage: "en",
                includedLanguages: INCLUDED_LANGUAGES,
                autoDisplay: false,
              },
              "google_translate_element"
            );
          }
        }
      } catch {
        // Silently ignore init failures to avoid breaking the app UI.
      }
    };

    loadGoogleTranslateScript();
  }, []);

  return <div id="google_translate_element" style={{ display: "none" }} suppressHydrationWarning />;
}

export function GoogleTranslateLanguageSelector({
  variant = "navbar",
  className,
  compact = false,
  iconOnly = false,
}: GoogleTranslateLanguageSelectorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const isIconOnly = iconOnly || compact;

  const wrapperClassName = useMemo(() => {
    if (variant === "sidebar") {
      return cn(
        "notranslate group flex w-full items-center gap-3 overflow-hidden rounded-xl border border-sidebar-border/70 bg-sidebar-accent/55 px-3.5 text-sidebar-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        compact ? "h-10 w-10 justify-center rounded-lg px-0" : "h-12 text-left",
        className
      );
    }

    return cn(
      "notranslate flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-foreground shadow-sm backdrop-blur",
      className
    );
  }, [variant, className, compact]);

  useEffect(() => {
    setSelectedLanguage(readCurrentLanguageFromCookie());
  }, []);

  useEffect(() => {
    loadGoogleTranslateScript();
  }, []);

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    setGoogleTranslateCookie(languageCode);

    const translated = triggerGoogleTranslateCombo(languageCode);
    if (!translated) {
      window.location.reload();
    }
  };

  const selectedLabel =
    LANGUAGE_OPTIONS.find((language) => language.code === selectedLanguage)?.label ||
    "English";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change website language"
          title={`Language: ${selectedLabel}`}
          className={cn(
            wrapperClassName,
            isIconOnly &&
              (variant === "sidebar"
                ? "h-10 w-10 justify-center rounded-lg p-0"
                : "h-9 w-9 justify-center p-0")
          )}
        >
          <Globe
            className={cn(
              "h-4 w-4 shrink-0 text-primary",
              variant === "sidebar" &&
                "text-sidebar-primary transition-transform duration-200 group-hover:scale-110"
            )}
            aria-hidden="true"
          />

          {!isIconOnly && (
            <>
              {variant === "sidebar" ? (
                <span className="grid flex-1 text-left leading-none">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Language
                  </span>
                  <span className="pt-1 text-sm font-medium">{selectedLabel}</span>
                </span>
              ) : (
                <span className="text-xs font-medium leading-none">{selectedLabel}</span>
              )}
              <ChevronDown
                className={cn(
                  "ml-auto h-3.5 w-3.5 opacity-80 transition-transform duration-200",
                  variant === "sidebar" && "h-4 w-4"
                )}
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        side={variant === "sidebar" && !isIconOnly ? "top" : "bottom"}
        className={cn(
          "min-w-44",
          variant === "sidebar" &&
            "w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border-sidebar-border/70 bg-sidebar p-1.5 shadow-xl"
        )}
      >
        {LANGUAGE_OPTIONS.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={cn(
              "cursor-pointer",
              variant === "sidebar" &&
                "rounded-lg px-3 py-2.5 text-sm transition-colors focus:bg-sidebar-accent"
            )}
          >
            <span className="mr-2 inline-flex w-4 items-center justify-center">
              {selectedLanguage === language.code ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
            </span>
            {language.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
