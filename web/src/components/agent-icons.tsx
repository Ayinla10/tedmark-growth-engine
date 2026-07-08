"use client";

import { motion } from "framer-motion";

type IconProps = { active?: boolean; size?: number; className?: string };

// Radar sweep — a rotating line inside a circle, with a "blip" that fades
// in and out. Only spins when Scout has genuinely run recently.
export function ScoutIcon({ active, size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <motion.g
        style={{ originX: "16px", originY: "16px" }}
        animate={active ? { rotate: 360 } : { rotate: 0 }}
        transition={active ? { duration: 3, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
      >
        <line x1="16" y1="16" x2="16" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </motion.g>
      <motion.circle
        cx="21"
        cy="10"
        r="1.6"
        fill="currentColor"
        animate={active ? { opacity: [0, 1, 0] } : { opacity: 0 }}
        transition={active ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
      />
    </svg>
  );
}

// Scanning rings — concentric circles pulsing outward, like a lead being
// actively evaluated. Static single ring when idle.
export function QualifierIcon({ active, size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4l10 4v8c0 7-4.5 11-10 12-5.5-1-10-5-10-12V8l10-4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11.5 16l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {active
        ? [0, 1].map((i) => (
            <motion.circle
              key={i}
              cx="16"
              cy="16"
              r="10"
              stroke="currentColor"
              strokeWidth="1"
              initial={{ opacity: 0.6, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
            />
          ))
        : null}
    </svg>
  );
}

// Typing dots — the classic chat "writing a reply" indicator.
export function OutreachIcon({ active, size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="4" y="7" width="24" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 9l11 8 11-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(0, 21)">
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={12 + i * 4}
            cy="0"
            r="1.4"
            fill="currentColor"
            animate={active ? { y: [0, -3, 0] } : { y: 0 }}
            transition={active ? { duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" } : {}}
          />
        ))}
      </g>
    </svg>
  );
}

// Ticking clock hand — sweeps forward in discrete steps, like a scheduler
// checking in at intervals rather than a smooth continuous spin.
export function SequencerIcon({ active, size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="16" x2="16" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <motion.line
        x1="16"
        y1="16"
        x2="21"
        y2="16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ originX: "16px", originY: "16px" }}
        animate={active ? { rotate: [0, 90, 180, 270, 360] } : { rotate: 0 }}
        transition={active ? { duration: 4, repeat: Infinity, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] } : {}}
      />
    </svg>
  );
}

// Document assembling — lines grow in from left to right in sequence, like
// a proposal being written out.
export function ProposalIcon({ active, size = 28, className }: IconProps) {
  const lines = [8, 20, 16];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
      {lines.map((w, i) => (
        <motion.line
          key={i}
          x1="10"
          y1={11 + i * 5}
          x2={10 + w}
          y2={11 + i * 5}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: active ? 0 : 1 }}
          animate={active ? { pathLength: [0, 1, 1, 0] } : { pathLength: 1 }}
          transition={active ? { duration: 3, repeat: Infinity, delay: i * 0.3, times: [0, 0.3, 0.85, 1] } : {}}
        />
      ))}
    </svg>
  );
}
