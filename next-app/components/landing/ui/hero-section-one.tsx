import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronRight, CirclePlay } from 'lucide-react'

export default function HeroSection() {
    return (
        <>
            
            <main className="overflow-hidden">
                <section className="bg-background">
                    <div className="relative py-36">
                        <div className="relative z-10 mx-auto w-full max-w-5xl px-6">
                            <div className="md:w-1/2">
                                <div>
                                    <h1 className="max-w-md text-balance text-5xl font-medium md:text-6xl">Connect with top talent</h1>
                                    <p className="text-muted-foreground my-8 max-w-2xl text-balance text-xl">Find the right contractors and projects. One platform for seamless collaboration.</p>

                                    <div className="flex items-center gap-3">
                                        <Button
                                            asChild
                                            size="lg"
                                            className="pr-4.5">
                                            <Link href="/signup">
                                                <span className="text-nowrap">Get Started</span>
                                                <ChevronRight className="opacity-50" />
                                            </Link>
                                        </Button>
                                        <Button
                                            key={2}
                                            asChild
                                            size="lg"
                                            variant="outline"
                                            className="pl-5">
                                            <Link href="/login">
                                                <CirclePlay className="fill-primary/25 stroke-primary" />
                                                <span className="text-nowrap">Sign In</span>
                                            </Link>
                                        </Button>
                                    </div>
                                </div>

                        
                            </div>
                        </div>

                        <div className="perspective-near mt-24 translate-x-12 md:absolute md:-right-6 md:bottom-16 md:left-1/2 md:top-40 md:mt-0 md:translate-x-0">
                            <div className="before:border-foreground/5 before:bg-foreground/5 relative h-full before:absolute before:-inset-x-4 before:bottom-7 before:top-0 before:skew-x-6 before:rounded-[calc(var(--radius)+1rem)] before:border">
                                <div className="bg-muted rounded-(--radius) shadow-foreground/10 ring-foreground/5 relative h-full -translate-y-12 skew-x-6 overflow-hidden border border-transparent shadow-md ring-1 w-full min-h-96 flex items-center justify-center">
                                    <span className="text-muted-foreground text-center">Your app screenshot here</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}