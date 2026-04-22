import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight, CirclePlay } from "lucide-react";

export default function HeroSection() {
  return (
    <main className="overflow-hidden">
      <section className="bg-background">
        <div className="relative py-24 md:py-32">
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <h1 className="max-w-xl text-balance text-5xl font-semibold md:text-6xl">
                  Build faster with one construction dashboard
                </h1>
                <p className="text-muted-foreground my-7 max-w-2xl text-balance text-lg md:text-xl">
                  Track attendance, projects, and safety checks in one place for workers,
                  contractors, and companies.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild size="lg" className="pr-4">
                    <Link href="/signup">
                      <span className="text-nowrap">Get Started</span>
                      <ChevronRight className="opacity-70" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="pl-5">
                    <Link href="/login">
                      <CirclePlay className="fill-primary/25 stroke-primary" />
                      <span className="text-nowrap">Sign In</span>
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-3 shadow-sm">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Product Dashboard
                </p>
                <div className="overflow-hidden rounded-xl border">
                  <Image
                    src="/light-dashboard.png"
                    alt="BuildSync dashboard light mode"
                    width={1200}
                    height={700}
                    className="h-auto w-full object-cover dark:hidden"
                    priority
                  />
                  <Image
                    src="/dark-dashboard.png"
                    alt="BuildSync dashboard dark mode"
                    width={1200}
                    height={700}
                    className="hidden h-auto w-full object-cover dark:block"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
