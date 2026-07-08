"use client";

import { motion } from "framer-motion";

// The central "brain" of the command center: layered counter-rotating rings,
// a pulsing reactor core, and a soft radial glow. Purely ambient — the real
// activity signals live on the agent nodes and connections around it.
export function JarvisCore({ size = 260 }: { size?: number }) {
  const c = size / 2;
  return (
    <div style={{ width: size, height: size }} className="relative">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0.05) 45%, transparent 70%)" }}
      />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className="relative">
        {/* Outer thin ring with tick marks */}
        <motion.g
          style={{ originX: `${c}px`, originY: `${c}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          <circle cx={c} cy={c} r={c - 4} stroke="#38bdf8" strokeOpacity="0.25" strokeWidth="1" />
          {Array.from({ length: 36 }).map((_, i) => {
            const a = (i / 36) * Math.PI * 2;
            const r1 = c - 4;
            const r2 = i % 3 === 0 ? c - 12 : c - 8;
            // Fixed precision keeps server- and client-rendered coordinate
            // strings identical, avoiding hydration mismatches.
            return (
              <line
                key={i}
                x1={(c + r1 * Math.cos(a)).toFixed(2)}
                y1={(c + r1 * Math.sin(a)).toFixed(2)}
                x2={(c + r2 * Math.cos(a)).toFixed(2)}
                y2={(c + r2 * Math.sin(a)).toFixed(2)}
                stroke="#38bdf8"
                strokeOpacity={i % 3 === 0 ? 0.5 : 0.25}
                strokeWidth="1"
              />
            );
          })}
        </motion.g>

        {/* Segmented arc ring */}
        <motion.circle
          cx={c}
          cy={c}
          r={c * 0.72}
          stroke="#38bdf8"
          strokeOpacity="0.6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${c * 0.72 * 1.2} ${c * 0.72 * 3.3}`}
          style={{ originX: `${c}px`, originY: `${c}px` }}
          animate={{ rotate: -360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />
        <motion.circle
          cx={c}
          cy={c}
          r={c * 0.6}
          stroke="#818cf8"
          strokeOpacity="0.5"
          strokeWidth="1.5"
          strokeDasharray="4 8"
          style={{ originX: `${c}px`, originY: `${c}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner triple arcs */}
        <motion.circle
          cx={c}
          cy={c}
          r={c * 0.42}
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${c * 0.42 * 1.6} ${c * 0.42 * 4.7}`}
          style={{ originX: `${c}px`, originY: `${c}px` }}
          animate={{ rotate: -360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />

        {/* Reactor core */}
        <motion.circle
          cx={c}
          cy={c}
          r={c * 0.2}
          fill="url(#coreGlow)"
          animate={{ scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ originX: `${c}px`, originY: `${c}px` }}
        />
        <motion.circle
          cx={c}
          cy={c}
          r={c * 0.08}
          fill="#e0f2fe"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />

        <defs>
          <radialGradient id="coreGlow">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.15" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}

// Voice-assistant style waveform: bars oscillating at staggered phases.
export function Waveform({ bars = 40, height = 26, color = "#818cf8" }: { bars?: number; height?: number; color?: string }) {
  return (
    <div className="flex items-center gap-[2px]" style={{ height }} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const base = 3 + Math.abs(Math.sin(i * 1.7)) * 5;
        const peak = 8 + Math.abs(Math.sin(i * 0.9)) * (height - 8);
        return (
          <motion.span
            key={i}
            className="w-[2px] rounded-full"
            style={{ background: color, opacity: 0.85 }}
            animate={{ height: [base, peak, base] }}
            transition={{ duration: 0.9 + (i % 5) * 0.18, repeat: Infinity, ease: "easeInOut", delay: (i % 7) * 0.1 }}
          />
        );
      })}
    </div>
  );
}
