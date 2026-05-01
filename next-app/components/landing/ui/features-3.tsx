'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Radar, ClipboardCheck, Globe2, Layers3, ArrowUpRight } from 'lucide-react'

const headingClass = 'text-balance text-4xl font-semibold md:text-5xl'

const cards = [
  {
    title: 'Unified command center',
    body: 'Monitor every build, crew, and supplier from a single operational view that updates in real time.',
    icon: Radar,
  },
  {
    title: 'Audit-ready compliance',
    body: 'Digital checklists, AI attendance, and evidence trails keep inspections clean and predictable.',
    icon: ClipboardCheck,
  },
  {
    title: 'Global contractor network',
    body: 'Source verified contractors, align scope, and lock in timelines without email chaos.',
    icon: Globe2,
  },
  {
    title: 'Layered BIM insight',
    body: 'Tie IFC models to schedule and material status so delays surface before they compound.',
    icon: Layers3,
  },
]

export default function Features() {
  return (
    <section id="features" className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Core platform</p>
            <h2 className={headingClass}>Designed for the pace of modern construction.</h2>
            <p className="max-w-xl text-balance text-lg text-muted-foreground">
              Every module is tuned for field conditions, with instant updates, fast offline recovery, and
              high-clarity reporting that scales from single sites to multi-region portfolios.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start a pilot
                  <ArrowUpRight className="opacity-70" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">View live workspace</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            viewport={{ once: true }}
            className="grid gap-4 md:grid-cols-2"
          >
            {cards.map((card, index) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.title}
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className={`rounded-3xl border border-border bg-card/80 p-6 ${
                    index === 0 ? 'md:col-span-2' : ''
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{card.body}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
