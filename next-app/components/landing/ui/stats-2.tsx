'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

interface StatCounter {
  label: string
  value: number
  suffix: string
}

const headingClass = 'text-balance text-4xl font-semibold md:text-5xl'

const AnimatedCounter = ({ value, suffix }: { value: number; suffix: string }) => {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return

    let frame = 0
    const total = 70
    const tick = () => {
      frame += 1
      const next = Math.round((frame / total) * value)
      setCount(next)
      if (frame < total) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [isInView, value])

  return (
    <span ref={ref} className="text-foreground">
      {count.toLocaleString()}{suffix}
    </span>
  )
}

export default function Stats() {
  const stats: StatCounter[] = [
    { label: 'Projects coordinated per quarter', value: 2140, suffix: '+' },
    { label: 'Punch-list items closed on time', value: 98, suffix: '%' },
    { label: 'Verified contractors onboarded', value: 540, suffix: '+' },
  ]

  return (
    <section id="about" className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Proof of performance
            </p>
            <h2 className={headingClass}>Construction leaders stay ahead with measurable outcomes.</h2>
            <p className="max-w-xl text-balance text-lg text-muted-foreground">
              InfraSaathi turns field activity into clear metrics, closing the gap between what was planned
              and what actually happened on site.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-border bg-card/80 p-6"
          >
            <div className="space-y-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-2xl font-semibold">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
          viewport={{ once: true }}
          className="mt-12 rounded-3xl border border-border bg-card/70 p-6"
        >
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>Weekly site velocity</span>
            <span>10 sites reporting</span>
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2 md:grid-cols-12">
            {Array.from({ length: 12 }).map((_, index) => (
              <motion.div
                key={index}
                initial={{ height: 18 }}
                whileInView={{ height: 30 + (index % 4) * 16 }}
                transition={{ duration: 0.6, delay: index * 0.04 }}
                viewport={{ once: true }}
                className="flex items-end"
              >
                <div className="h-full w-full rounded-full bg-primary/20" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
