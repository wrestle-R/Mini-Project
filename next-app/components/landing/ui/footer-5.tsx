import React from 'react'
import Link from 'next/link'

const links = [
    { label: 'Features', href: '#features' },
    { label: 'About', href: '#about' },
    { label: 'Team', href: '#team' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Login', href: '/login' },
    { label: 'Sign Up', href: '/signup' },
]

export default function Footer() {
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <footer className="bg-background border-t border-border @container py-12">
            <div className="mx-auto max-w-5xl px-6">
                <div className="flex flex-col">
                    <Link
                        href="/"
                        aria-label="go home"
                        className="flex items-center gap-0.5">
                        <span className="text-base font-bold text-primary">Build</span>
                        <span className="text-base font-bold text-foreground">Sync</span>
                    </Link>
                    <p className="text-muted-foreground mt-3 max-w-xs text-sm">Smart construction management for companies, contractors, and workers.</p>
                    <nav className="my-8 flex flex-wrap gap-x-8 gap-y-2">
                        {links.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <p className="text-muted-foreground mt-2 border-t pt-6 text-sm">
                        &copy; {mounted ? new Date().getFullYear() : 2026} BuildSync. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
}
