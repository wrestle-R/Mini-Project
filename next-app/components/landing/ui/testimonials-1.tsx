import Image from 'next/image'

const testimonials = [
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Priya+Sharma&backgroundColor=e8813a',
        name: 'Priya Sharma',
        role: 'Project Manager, Alpha Constructions',
        quote: 'BuildSync completely changed how we manage our job sites. We used to lose hours chasing contractor updates—now everything is in one place and our on-time delivery has jumped by 30%.',
    },
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Karan+Mehta&backgroundColor=3b6cb7',
        name: 'Karan Mehta',
        role: 'Director, BuildCo Infrastructure',
        quote: 'The contractor matching feature is outstanding. We found three certified teams within a day of posting a project. The quality control tools keep everyone accountable.',
    },
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Asha+Nair&backgroundColor=5c7a4e',
        name: 'Asha Nair',
        role: 'Site Supervisor, SiteForce Ltd.',
        quote: 'I can see attendance, task progress, and safety checklists for all 80 workers from my phone. BuildSync is like having a second set of eyes on every corner of the site.',
    },
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Ravi+Patel&backgroundColor=7c4fa0',
        name: 'Ravi Patel',
        role: 'CEO, UrbanRaise Developers',
        quote: 'Before BuildSync, we ran everything on spreadsheets and WhatsApp. Now our entire pipeline is transparent—investors love the real-time dashboards we can share with them.',
    },
]

export default function Testimonials() {
    return (
        <section className="bg-background @container py-24">
            <div className="mx-auto max-w-5xl px-6">
                <div className="space-y-4">
                    <h2 className="text-balance text-4xl font-medium">What our customers say</h2>
                    <p className="text-muted-foreground text-balance">Hear from construction teams who&apos;ve transformed their operations with BuildSync.</p>
                </div>
                <div className="@xl:grid-cols-2 mt-12 grid gap-3">
                    {testimonials.map((testimonial, index) => (
                        <div
                            key={index}
                            className="bg-card ring-border text-foreground space-y-3 rounded-2xl p-4 text-sm ring-1">
                            <div className="flex gap-3">
                                <div className="before:border-foreground/10 relative size-5 shrink-0 rounded-full before:absolute before:inset-0 before:rounded-full before:border">
                                    <Image
                                        src={testimonial.avatar}
                                        alt={testimonial.name}
                                        className="rounded-full object-cover"
                                        width={40}
                                        height={40}
                                    />
                                </div>
                                <p className="text-sm font-medium">
                                    {testimonial.name} <span className="text-muted-foreground ml-2 font-normal">{testimonial.role}</span>
                                </p>
                            </div>

                            <p className="text-muted-foreground text-sm">{testimonial.quote}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
