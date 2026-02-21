'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

const faqItems = [
    {
        id: 'item-1',
        question: 'Who is BuildSync for?',
        answer: 'BuildSync is designed for construction companies, site managers, contractors, and workers. Whether you run a small renovation crew or manage a multi-site commercial development, BuildSync scales to your needs.',
    },
    {
        id: 'item-2',
        question: 'How does contractor verification work?',
        answer: 'Contractors go through a profile review process where they submit credentials, certifications, and past project references. Once verified, they appear in the contractor marketplace where companies can hire them directly.',
    },
    {
        id: 'item-3',
        question: 'Can I track worker attendance on-site?',
        answer: 'Yes. BuildSync includes smart attendance tracking with face recognition powered by our AI engine. Workers can be clocked in automatically at the site, reducing manual errors and ghost attendance.',
    },
    {
        id: 'item-4',
        question: 'How do I manage multiple projects at once?',
        answer: 'Your company dashboard gives you a bird-eye view of all active projects. You can drill down into individual sites, reassign contractors, track milestones, and review compliance—all from one interface.',
    },
    {
        id: 'item-5',
        question: 'Is my project data secure?',
        answer: 'Absolutely. All data is encrypted in transit and at rest. Role-based access control ensures that workers see only what they need, contractors manage only their assigned tasks, and admins have full visibility.',
    },
    {
        id: 'item-6',
        question: 'Can I try BuildSync before committing?',
        answer: 'Yes—sign up for free and explore the platform with a demo project. No credit card required. You can invite your team and start managing a real project from day one.',
    },
]

export default function FAQs() {
    return (
        <section
            id="faq"
            className="bg-background @container py-24">
            <div className="mx-auto max-w-5xl px-6">
                <div className="text-center">
                    <h2 className="text-balance text-4xl font-medium">Frequently asked questions</h2>
                    <p className="text-muted-foreground mx-auto mt-4 max-w-md text-balance">Everything you need to know about BuildSync.</p>
                </div>
                <Card
 
                    className="mt-12 p-2">
                    <Accordion
                        type="single"
                        collapsible>
                        {faqItems.map((item) => (
                            <AccordionItem
                                key={item.id}
                                value={item.id}
                                className="border-b-0 px-4">
                                <AccordionTrigger className="cursor-pointer py-4 text-sm font-medium hover:no-underline">{item.question}</AccordionTrigger>
                                <AccordionContent>
                                    <p className="text-muted-foreground pb-2 text-sm">{item.answer}</p>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </Card>
                <p className="text-muted-foreground mt-6 text-center text-sm">
                    Still have questions?{' '}
                    <Link
                        href="/signup"
                        className="text-primary font-medium hover:underline">
                        Get in touch with the team
                    </Link>
                </p>
            </div>
        </section>
    )
}
