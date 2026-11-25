'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

const headingClass = 'text-balance text-4xl font-semibold md:text-5xl'

const testimonials = [
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Priya+Sharma&backgroundColor=e8813a',
        name: 'Priya Sharma',
        role: 'Project Manager, Alpha Constructions',
        quote: 'We replaced four spreadsheets and a dozen WhatsApp threads. Now the whole project pulse is visible in seconds.',
    },
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Karan+Mehta&backgroundColor=3b6cb7',
        name: 'Karan Mehta',
        role: 'Director, BuildCo Infrastructure',
        quote: 'Compliance reports that used to take two days are now ready before our morning stand-up.',
    },
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Asha+Nair&backgroundColor=5c7a4e',
        name: 'Asha Nair',
        role: 'Site Supervisor, SiteForce Ltd.',
        quote: 'I can spot attendance gaps and material delays before the teams arrive on site.',
    },
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Ravi+Patel&backgroundColor=7c4fa0',
        name: 'Ravi Patel',
        role: 'CEO, UrbanRaise Developers',
        quote: 'Investors love the live dashboards. We now show progress without custom reporting.',
    },
]

export default function Testimonials() {
    return (
        <section className="bg-background py-24">
            <div className="mx-auto max-w-6xl px-6">
                <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        viewport={{ once: true }}
                        className="space-y-6"
                    >
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Customer voice</p>
                        <h2 className={headingClass}>Teams move faster when every update is trusted.</h2>
                        <p className="max-w-xl text-balance text-lg text-muted-foreground">
                            InfraSaathi aligns office leadership and field crews with the same real-time truth.
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
                            {testimonials.map((testimonial) => (
                                <div
                                    key={testimonial.name}
                                    className="flex gap-4 rounded-2xl border border-border bg-background/70 p-4"
                                >
                                    <Image
                                        src={testimonial.avatar}
                                        alt={testimonial.name}
                                        width={52}
                                        height={52}
                                        className="h-12 w-12 rounded-full object-cover"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                            {testimonial.role}
                                        </p>
                                        <p className="mt-3 text-sm text-muted-foreground">{testimonial.quote}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
