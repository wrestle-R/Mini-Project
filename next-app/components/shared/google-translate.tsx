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
        "notranslate flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar/70 px-2 py-1.5 text-sidebar-foreground",
        compact && "justify-center px-2",
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
                ? "h-8 w-full justify-center"
                : "h-9 w-9 justify-center p-0")
          )}
        >
          <Globe
            className={cn(
              "h-4 w-4 shrink-0 text-primary",
              variant === "sidebar" && "text-sidebar-primary"
            )}
            aria-hidden="true"
          />

          {!isIconOnly && (
            <>
              <span className="text-xs font-medium opacity-80">{selectedLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="min-w-44"
      >
        {LANGUAGE_OPTIONS.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="cursor-pointer"
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
