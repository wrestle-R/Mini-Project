'use client'
import { useState } from 'react'

import { Cloud, Cpu, Shield, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Feature = 'project-management' | 'real-time-updates' | 'contractor-network' | 'safety-compliance'

export default function Features() {
    const [feature, setFeature] = useState<Feature>('project-management')
    return (
        <section
            id="features"
            className="bg-background @container py-24">
            <div className="@2xl:grid-cols-2 mx-auto grid max-w-5xl gap-6 px-6">
                <div>
                    <div>
                        <h2 className="text-balance text-4xl font-medium">Everything you need to run a build site</h2>
                        <p className="text-muted-foreground mb-6 mt-4 text-balance">From project planning to contractor coordination—BuildSync gives your team the tools to deliver on time, every time.</p>
                        <Button
                            variant="secondary"
                            size="sm"
                            asChild
                            className="gap-1 pr-1.5">
                            <Link href="/login">
                                Get started
                                <ChevronRight />
                            </Link>
                        </Button>
                    </div>
                    <div className="mt-16 *:w-full *:cursor-pointer">
                        <button
                            onClick={() => setFeature('project-management')}
                            data-selected={feature === 'project-management'}
                            className="not-data-[selected=true]:hover:text-foreground not-data-[selected=true]:text-muted-foreground flex items-center gap-3 py-2 text-sm">
                            <div className="flex size-4 items-center -space-x-2">
                                <div className="size-3 shrink-0 rounded-full border border-current"></div>
                                <div className="size-3 shrink-0 rounded-full border border-current"></div>
                            </div>
                            <span className="in-data-[selected=true]:text-shadow-[0.2px_0_0_currentColor]">Smart Project Management</span>
                        </button>
                        <button
                            onClick={() => setFeature('real-time-updates')}
                            data-selected={feature === 'real-time-updates'}
                            className="not-data-[selected=true]:hover:text-foreground not-data-[selected=true]:text-muted-foreground flex items-center gap-3 py-2 text-sm">
                            <Cloud className="size-4" />
                            <span className="in-data-[selected=true]:text-shadow-[0.2px_0_0_currentColor]">Real-time Site Updates</span>
                        </button>
                        <button
                            onClick={() => setFeature('contractor-network')}
                            data-selected={feature === 'contractor-network'}
                            className="not-data-[selected=true]:hover:text-foreground not-data-[selected=true]:text-muted-foreground flex items-center gap-3 py-2 text-sm">
                            <Cpu className="size-4" />
                            <span className="in-data-[selected=true]:text-shadow-[0.2px_0_0_currentColor]">Contractor Network</span>
                        </button>
                        <button
                            onClick={() => setFeature('safety-compliance')}
                            data-selected={feature === 'safety-compliance'}
                            className="not-data-[selected=true]:hover:text-foreground not-data-[selected=true]:text-muted-foreground flex items-center gap-3 py-2 text-sm">
                            <Shield className="size-4" />
                            <span className="in-data-[selected=true]:text-shadow-[0.2px_0_0_currentColor]">Safety & Compliance</span>
                        </button>
                    </div>
                </div>
                <div className="@max-xl:-mx-6 not-dark:bg-linear-to-b not-dark:via-muted relative flex items-center overflow-hidden rounded-3xl *:w-full">
                    <div
                        aria-hidden
                        className={cn('*:bg-linear-to-r not-dark:opacity-50 mask-y-from-65% *:to-muted dark:*:to-foreground/2 absolute inset-0 grid grid-cols-4 duration-300', feature === 'project-management' && '*:bg-linear-to-t grid-cols-1 grid-rows-12', feature === 'contractor-network' && '*:bg-linear-to-l grid-cols-2 dark:opacity-50', feature === 'real-time-updates' && '*:opacity-35')}>
                        <div />
                        <div />
                        <div />
                        <div />
                    </div>
                    {feature === 'project-management' && <ProjectManagementIllustration />}
                    {feature === 'real-time-updates' && <RealTimeIllustration />}
                    {feature === 'contractor-network' && <ContractorIllustration />}
                    {feature === 'safety-compliance' && <SafetyIllustration />}
                </div>
            </div>
        </section>
    )
}

const ProjectManagementIllustration = () => {
    return (
        <div
            aria-hidden
            className="flex h-44 flex-col justify-center gap-3 px-6 py-4">
            {[
                { label: 'Foundation Work', w: '72%', color: 'bg-primary' },
                { label: 'Structural Frame', w: '48%', color: 'bg-chart-2' },
                { label: 'MEP Installation', w: '30%', color: 'bg-chart-4' },
            ].map((item) => (
                <div key={item.label}>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{item.label}</span>
                        <span>{item.w}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${item.color}`}
                            style={{ width: item.w }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}

const RealTimeIllustration = () => {
    return (
        <div
            aria-hidden
            className="relative h-44 translate-y-6">
            <div className="bg-foreground/15 absolute inset-0 mx-auto w-px"></div>
            <div className="absolute -inset-x-16 top-6 aspect-square rounded-full border"></div>
            <div className="border-primary mask-l-from-50% mask-l-to-90% mask-r-from-50% mask-r-to-50% absolute -inset-x-16 top-6 aspect-square rounded-full border"></div>
            <div className="absolute -inset-x-8 top-24 aspect-square rounded-full border"></div>
            <div className="mask-r-from-50% mask-r-to-90% mask-l-from-50% mask-l-to-50% absolute -inset-x-8 top-24 aspect-square rounded-full border border-lime-500"></div>
        </div>
    )
}

const SafetyIllustration = () => {
    return (
        <div
            aria-hidden
            className="relative flex size-44 items-center justify-center">
            <Shield className="absolute inset-0 size-full stroke-[0.1px] opacity-15" />
            <Shield className="fill-card dark:fill-foreground/10 drop-shadow-black/3 stroke-border size-32 stroke-[0.2px] drop-shadow-xl" />
        </div>
    )
}

const ContractorIllustration = () => {
    return (
        <div
            aria-hidden
            className="*:bg-foreground/15 flex h-44 justify-between pb-6 pt-12 *:h-full *:w-px">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div className="bg-primary!"></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div className="bg-primary!"></div>
            <div></div>
            <div></div>
            <div></div>
            <div className="bg-primary!"></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div className="bg-primary!"></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div className="bg-primary!"></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div className="bg-primary!"></div>
        </div>
    )
}
