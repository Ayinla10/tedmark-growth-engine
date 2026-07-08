"use client";

import { motion } from "framer-motion";

// A compact HUD-style "listening" ring, evoking a voice-assistant core:
// concentric arcs rotate at different speeds around a pulsing center dot.
export function JarvisRing({ size = 18 }: { size?: number }) {
  const r1 = size / 2 - 1;
  const r2 = size / 2 - 4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r1}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="2 4.5"
        opacity={0.8}
        style={{ originX: `${size / 2}px`, originY: `${size / 2}px` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r2}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="3 3"
        opacity={0.6}
        style={{ originX: `${size / 2}px`, originY: `${size / 2}px` }}
        animate={{ rotate: -360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={1.6}
        fill="currentColor"
        animate={{ scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}
