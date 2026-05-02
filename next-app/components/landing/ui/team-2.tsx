import Image from 'next/image'

const members = [
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Russel+Daniel+Paul&backgroundColor=e8813a&fontFamily=Georgia&fontSize=36&fontWeight=700',
        name: 'Russel Daniel Paul',
        role: 'Project Lead & Full Stack Developer',
    },
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Gavin&backgroundColor=5c7a4e&fontFamily=Georgia&fontSize=36&fontWeight=700',
        name: 'Gavin',
        role: 'Backend Engineer',
    },
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Mayanks&backgroundColor=3b6cb7&fontFamily=Georgia&fontSize=36&fontWeight=700',
        name: 'Mayanks',
        role: 'ML & AI Engineer',
    },
    {
        avatar: 'https://api.dicebear.com/9.x/initials/png?seed=Ankit&backgroundColor=7c4fa0&fontFamily=Georgia&fontSize=36&fontWeight=700',
        name: 'Ankit',
        role: 'Frontend Developer',
    },
]

export default function Team() {
    return (
        <section
            id="team"
            className="bg-background @container py-24">
            <div className="mx-auto max-w-5xl px-6">
                <div className="space-y-4">
                    <h2 className="text-balance text-4xl font-medium">Meet the team</h2>
                    <p className="text-muted-foreground text-balance">A passionate group of engineers and builders who understand construction—because we built InfraSaathi to solve real problems.</p>
                </div>
                <div className="@xl:grid-cols-4 @xl:gap-6 mt-12 grid grid-cols-2 gap-4 gap-y-6 text-sm">
                    {members.map((member, index) => (
                        <div
                            key={index}
                            className="flex flex-col gap-4">
                            <div className="before:border-foreground/10 shadow-foreground/6.5 dark:shadow-black/6.5 relative size-28 shrink-0 rounded-xl shadow-md before:absolute before:inset-0 before:rounded-xl before:border">
                                <Image
                                    src={member.avatar}
                                    alt={member.name}
                                    className="rounded-xl object-cover"
                                    width={120}
                                    height={120}
                                />
                            </div>

                            <div className="space-y-1">
                                <p className="text-foreground text-sm font-medium">{member.name}</p>
                                <p className="text-muted-foreground text-sm">{member.role}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
