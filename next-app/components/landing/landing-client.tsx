"use client";

import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { SiteFooter } from "@/components/landing/footer";

export default function LandingClient() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Hero />
      </main>
      <SiteFooter />
    </div>
  );
}
