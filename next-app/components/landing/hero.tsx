"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

export function Hero() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
        BuildSync keeps your site work in sync.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Minimal, focused tools for daily progress, task tracking, and team
        coordination.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Button asChild size="lg" className="cursor-pointer">
          <Link href="/signup">
            Get Started
            <FiArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="cursor-pointer">
          <Link href="/contractor/signup">Contractor Sign Up</Link>
        </Button>
      </div>
    </section>
  );
}
