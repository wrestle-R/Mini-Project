'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { motion } from 'framer-motion'

const headingClass = 'text-balance text-4xl font-semibold md:text-5xl'

const faqItems = [
    {
        id: 'item-1',
        question: 'Who is BuildSync built for?',
        answer: 'BuildSync supports owners, contractors, and field teams. It scales from small crews to multi-site programs without changing the workflow.',
    },
    {
        id: 'item-2',
        question: 'How does attendance verification work?',
        answer: 'Teams can use smart attendance with AI validation or manual check-ins. Both paths create timestamped audit trails.',
    },
    {
        id: 'item-3',
        question: 'Can we run multiple sites in parallel?',
        answer: 'Yes. The portfolio view gives rollups by region and lets you drill into each site with the same dashboard.',
    },
    {
        id: 'item-4',
        question: 'What about IFC and BIM workflows?',
        answer: 'BuildSync connects IFC models to task and material status so delays surface early and can be resolved before they cascade.',
    },
    {
        id: 'item-5',
        question: 'Is project data secure?',
        answer: 'Data is encrypted in transit and at rest with role-based access controls. Permissions follow project assignments.',
    },
    {
        id: 'item-6',
        question: 'Can we trial the platform first?',
        answer: 'You can start with a live demo workspace and invite your team before committing to a full rollout.',
    },
]

export default function FAQs() {
    return (
        <section id="faq" className="bg-background py-24">
            <div className="mx-auto max-w-6xl px-6">
                <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        viewport={{ once: true }}
                        className="space-y-6"
                    >
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Answers</p>
                        <h2 className={headingClass}>Everything your team needs to know before kickoff.</h2>
                        <p className="max-w-xl text-balance text-lg text-muted-foreground">
                            From security to workflow coverage, BuildSync is built to match how modern construction teams
                            operate.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Still have questions?{' '}
                            <Link href="/signup" className="font-semibold text-primary hover:underline">
                                Talk to the BuildSync team
                            </Link>
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                        viewport={{ once: true }}
                    >
                        <Card className="border-border bg-card/80 p-2">
                            <Accordion type="single" collapsible>
                                {faqItems.map((item) => (
                                    <AccordionItem key={item.id} value={item.id} className="border-b-0 px-4">
                                        <AccordionTrigger className="cursor-pointer py-4 text-sm font-medium hover:no-underline">
                                            {item.question}
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <p className="pb-2 text-sm text-muted-foreground">{item.answer}</p>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
