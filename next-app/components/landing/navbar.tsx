'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { GoogleTranslateLanguageSelector } from '@/components/shared/google-translate'

const NavItem = ({ item, onNavigate }: { item: { name: string; link: string; external?: boolean }; onNavigate: (id: string) => void }) => {
    return (
        <motion.a
            href={item.link}
            onClick={(e) => {
                if (!item.external) {
                    e.preventDefault()
                    onNavigate(item.link)
                }
            }}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
            className="relative px-3 py-2 text-sm font-medium tracking-wide"
            style={{ color: 'oklch(var(--foreground))' }}
            whileHover="hover"
            initial="initial"
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
            <span className="relative z-10">{item.name}</span>
            <motion.span
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'oklch(var(--muted))' }}
                initial={{ scale: 0.8, opacity: 0 }}
                variants={{ initial: { scale: 0.8, opacity: 0 }, hover: { scale: 1, opacity: 1 } }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            />
        </motion.a>
    )
}

export function Navbar() {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollY } = useScroll({ target: ref, offset: ['start start', 'end start'] })
    const [visible, setVisible] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme, setTheme } = useTheme()

    const navItems = [
        { name: 'Features', link: '#features' },
        { name: 'About', link: '#about' },
        { name: 'FAQ', link: '#faq' },
    ]

    useMotionValueEvent(scrollY, 'change', (latest) => {
        setVisible(latest > 50)
    })

    useEffect(() => {
        setMounted(true)
    }, [])

    const scrollToSection = (sectionId: string) => {
        const element = document.querySelector(sectionId)
        if (element) element.scrollIntoView({ behavior: 'smooth' })
        setMobileMenuOpen(false)
    }

    const handleThemeToggle = () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }

    const isDark = mounted && resolvedTheme === 'dark'

    return (
        <motion.div
            ref={ref}
            className="fixed inset-x-0 top-0 z-40 mx-auto mb-16 md:mb-0 max-w-5xl">
            {/* Desktop Navbar */}
            <motion.div
                animate={{
                    backdropFilter: visible ? 'blur(16px)' : 'none',
                    border: visible ? '1px solid oklch(var(--border))' : 'none',
                    width: visible ? '65%' : '80%',
                    y: visible ? 16 : 0,
                    backgroundColor: visible ? 'rgb(var(--background) / 0.85)' : 'transparent',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 40, duration: 0.3 }}
                style={{ minWidth: visible ? '700px' : '600px' }}
                className="relative z-[60] mx-auto hidden w-full max-w-5xl flex-row items-center justify-between rounded-full px-8 py-3 md:flex">
                <div className="flex w-full items-center justify-between">
                    <motion.div
                        animate={{ scale: visible ? 0.85 : 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
                        <Link
                            href="/"
                            className="flex items-center gap-0.5">
                            <span className="text-lg font-bold tracking-tight text-primary">Build</span>
                            <span className="text-lg font-bold tracking-tight text-foreground">Sync</span>
                        </Link>
                    </motion.div>

                    <motion.nav
                        animate={{ opacity: 1, scale: visible ? 0.9 : 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="absolute left-1/2 flex -translate-x-1/2 items-center space-x-1">
                        {navItems.map((item, idx) => (
                            <NavItem
                                key={idx}
                                item={item}
                                onNavigate={scrollToSection}
                            />
                        ))}
                    </motion.nav>

                    <div className="flex items-center space-x-3">
                        <GoogleTranslateLanguageSelector iconOnly />

                        <motion.button
                            onClick={handleThemeToggle}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            animate={{ scale: visible ? 0.9 : 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="p-2 rounded-full bg-muted text-foreground"
                            aria-label="Toggle theme">
                            {isDark ? (
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                                    />
                                </svg>
                            ) : (
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                                    />
                                </svg>
                            )}
                        </motion.button>

                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            animate={{ scale: visible ? 0.9 : 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                            <Link
                                href="/login"
                                className="px-4 py-2 rounded-full text-sm font-medium inline-block tracking-wide bg-primary text-primary-foreground">
                                Get Started
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* Mobile Navbar */}
            <motion.div
                animate={{
                    backdropFilter: visible ? 'blur(16px)' : 'none',
                    border: visible ? '1px solid oklch(var(--border))' : 'none',
                    y: visible ? 16 : 0,
                    backgroundColor: visible ? 'rgb(var(--background) / 0.85)' : 'transparent',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                className="md:hidden flex items-center justify-between px-6 py-3 mt-4 mx-6 rounded-full">
                <Link
                    href="/"
                    className="flex items-center gap-0.5">
                    <motion.span
                        animate={{ scale: visible ? 0.85 : 1 }}
                        className="text-lg font-extrabold tracking-tight text-primary">
                        Build
                    </motion.span>
                    <motion.span
                        animate={{ scale: visible ? 0.85 : 1 }}
                        className="text-lg font-extrabold tracking-tight text-foreground">
                        Sync
                    </motion.span>
                </Link>

                <div className="flex items-center space-x-2">
                    <motion.button
                        onClick={handleThemeToggle}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="p-1.5 rounded-full bg-muted text-foreground"
                        aria-label="Toggle theme">
                        {isDark ? (
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                            </svg>
                        ) : (
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                                />
                            </svg>
                        )}
                    </motion.button>

                    <motion.button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="text-xl p-1 text-foreground"
                        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={mobileMenuOpen}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                        {mobileMenuOpen ? (
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        ) : (
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        )}
                    </motion.button>
                </div>
            </motion.div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="md:hidden absolute top-full left-0 right-0 mt-2 mx-6">
                        <div className="backdrop-blur-xl rounded-2xl p-4 space-y-2 shadow-2xl bg-muted/50 border border-border">
                            <GoogleTranslateLanguageSelector iconOnly />

                            {navItems.map((item, idx) => (
                                <motion.a
                                    key={idx}
                                    href={item.link}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        scrollToSection(item.link)
                                    }}
                                    className="block w-full text-left py-2 px-3 rounded-xl transition-colors tracking-wide text-sm text-foreground"
                                    whileTap={{ scale: 0.95 }}
                                    whileHover={{ x: 4 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                    {item.name}
                                </motion.a>
                            ))}
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                <Link
                                    href="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block w-full mt-3 px-4 py-2 rounded-xl text-center font-medium tracking-wide text-sm bg-primary text-primary-foreground">
                                    Get Started
                                </Link>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
