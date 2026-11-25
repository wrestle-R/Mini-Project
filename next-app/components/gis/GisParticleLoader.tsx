"use client";

import { motion } from "framer-motion";

type Variant = "compact" | "medium" | "large";

const SIZES: Record<Variant, { size: number; orbitRadius: number[] }> = {
  compact: { size: 48, orbitRadius: [8, 16, 24] },
  medium: { size: 80, orbitRadius: [14, 28, 42] },
  large: { size: 120, orbitRadius: [20, 40, 60] },
};

interface GisParticleLoaderProps {
  variant?: Variant;
  label?: string;
}

export default function GisParticleLoader({
  variant = "medium",
  label,
}: GisParticleLoaderProps) {
  const { size, orbitRadius } = SIZES[variant];
  const particleSize = variant === "compact" ? 4 : variant === "medium" ? 6 : 8;

  const orbits = [
    { radius: orbitRadius[0], duration: 1, delay: 0, speed: 1 },
    { radius: orbitRadius[1], duration: 1.5, delay: 0.1, speed: 0.67 },
    { radius: orbitRadius[2], duration: 2, delay: 0.2, speed: 0.5 },
  ];

  return (
    <div className="flex items-center justify-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-lg"
      >
        {/* Center glow */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={particleSize * 0.8}
          fill="url(#particleGradient)"
          opacity="0.6"
        />

        {/* Orbital paths (subtle guides) */}
        {orbits.map((orbit, idx) => (
          <circle
            key={`path-${idx}`}
            cx={size / 2}
            cy={size / 2}
            r={orbit.radius}
            fill="none"
            stroke="rgba(99, 102, 241, 0.1)"
            strokeWidth="0.5"
          />
        ))}

        {/* Particles */}
        {orbits.map((orbit, orbitIdx) =>
          [0, 120, 240].map((offset, particleIdx) => {
            const particleKey = `particle-${orbitIdx}-${particleIdx}`;
            return (
              <motion.circle
                key={particleKey}
                cx={size / 2}
                cy={size / 2 - orbit.radius}
                r={particleSize}
                fill="url(#particleGradient)"
                animate={{
                  rotate: [0, 360],
                }}
                transition={{
                  duration: orbit.duration,
                  repeat: Infinity,
                  ease: "linear",
                  delay: orbit.delay + (offset / 360) * orbit.duration,
                }}
                style={{
                  originX: size / 2,
                  originY: size / 2,
                }}
                opacity={0.8}
                filter="drop-shadow(0 0 2px rgba(99, 102, 241, 0.8))"
              />
            );
          })
        )}

        {/* Gradient definitions */}
        <defs>
          <linearGradient
            id="particleGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="1" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>

      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
