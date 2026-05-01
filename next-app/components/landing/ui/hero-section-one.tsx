'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronRight, CirclePlay, HardHat, ShieldCheck, Radar } from 'lucide-react'
import { motion } from 'framer-motion'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: 'easeOut' },
  },
}

const glowVariants = {
  initial: { opacity: 0.4, scale: 0.9 },
  animate: {
    opacity: [0.4, 0.7, 0.4],
    scale: [0.9, 1.05, 0.9],
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
  },
}

const headingClass = 'text-balance text-4xl font-semibold md:text-5xl'

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.04),transparent)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Live site intelligence
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className={`${headingClass} mt-6 max-w-xl text-foreground`}
            >
              The construction OS that keeps every crew, site, and stakeholder in sync.
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-5 max-w-xl text-balance text-lg text-muted-foreground"
            >
              BuildSync unifies attendance, compliance, and project delivery into a single control
              plane. See work progress in real time and keep every handoff accountable.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button asChild size="lg" className="pr-4">
                <Link href="/signup">
                  Launch a site
                  <ChevronRight className="opacity-70" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="pl-5">
                <Link href="/login">
                  <CirclePlay className="fill-primary/25 stroke-primary" />
                  Schedule a demo
                </Link>
              </Button>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="mt-10 grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-3"
            >
              {[
                { label: 'Active builds', value: '2,140+' },
                { label: 'Daily check-ins', value: '120k+' },
                { label: 'Safety flags cleared', value: '98.6%' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border bg-card/70 p-4">
                  <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em]">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative"
          >
            <motion.div
              variants={glowVariants}
              initial="initial"
              animate="animate"
              className="absolute -inset-6 rounded-[32px] bg-primary/10 blur-3xl"
            />
            <div className="relative rounded-[28px] border border-border bg-card/80 p-6 shadow-2xl">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-[0.2em]">Operations pulse</span>
                <span>Live</span>
              </div>
              <div className="mt-6 grid gap-4">
                {[
                  { icon: HardHat, title: 'Crew alignment', detail: '12 teams synced' },
                  { icon: ShieldCheck, title: 'Safety checks', detail: '3 items pending' },
                  { icon: Radar, title: 'Material flow', detail: 'Arrival in 42 min' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <motion.div
                      key={item.title}
                      whileHover={{ y: -2 }}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-background/60 p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Site velocity</span>
                  <span>+18% week over week</span>
                </div>
                <div className="mt-3 flex h-20 items-end gap-1">
                  {Array.from({ length: 18 }).map((_, index) => (
                    <motion.span
                      key={index}
                      className="h-full w-full rounded-full bg-primary/15"
                      initial={{ height: '20%' }}
                      animate={{ height: `${25 + (index % 6) * 10}%` }}
                      transition={{ duration: 1.2, delay: index * 0.04 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
