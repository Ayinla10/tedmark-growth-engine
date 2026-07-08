"use client";

import { motion } from "framer-motion";

// Radar-style scope: rotating sweep with fixed blips, like the core is
// scanning its agents. Blip positions are fixed (not random) so server and
// client render identically.
const BLIPS = [
  { x: 38, y: 30 },
  { x: 72, y: 44 },
  { x: 50, y: 68 },
  { x: 28, y: 58 },
  { x: 64, y: 22 },
];

export function AiCoreViz({ size = 130 }: { size?: number }) {
  const c = 50;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {[46, 34, 22, 10].map((r) => (
        <circle key={r} cx={c} cy={c} r={r} stroke="#38bdf8" strokeOpacity="0.18" strokeWidth="0.8" />
      ))}
      <line x1={c} y1="4" x2={c} y2="96" stroke="#38bdf8" strokeOpacity="0.12" strokeWidth="0.8" />
      <line x1="4" y1={c} x2="96" y2={c} stroke="#38bdf8" strokeOpacity="0.12" strokeWidth="0.8" />

      <motion.g
        style={{ originX: "50px", originY: "50px" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
      >
        <path d="M50 50 L50 4 A46 46 0 0 1 74 11 Z" fill="#38bdf8" fillOpacity="0.15" />
        <line x1={c} y1={c} x2={c} y2="4" stroke="#7dd3fc" strokeWidth="1" strokeOpacity="0.8" />
      </motion.g>

      {BLIPS.map((b, i) => (
        <motion.circle
          key={i}
          cx={b.x}
          cy={b.y}
          r="1.8"
          fill="#7dd3fc"
          animate={{ opacity: [0.15, 1, 0.15] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.45, ease: "easeInOut" }}
        />
      ))}
      <circle cx={c} cy={c} r="2.4" fill="#bae6fd" />
    </svg>
  );
}
