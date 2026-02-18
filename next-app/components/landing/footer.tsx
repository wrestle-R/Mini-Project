"use client";

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} BuildSync</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hover:text-foreground">
            Login
          </Link>
          <Link href="/signup" className="hover:text-foreground">
            Sign Up
          </Link>
          <Link href="/contractor/login" className="hover:text-foreground">
            Contractor
          </Link>
        </div>
      </div>
    </footer>
  );
}
