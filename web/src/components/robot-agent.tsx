"use client";

import { motion } from "framer-motion";
import { useId } from "react";

export type RobotVariant = "scout" | "qualifier" | "outreach" | "sequencer" | "proposal" | "analytics";

type RobotProps = {
  variant: RobotVariant;
  active: boolean;
  color: string;
  size?: number;
  /** Fill the parent width instead of a fixed pixel size, keeping the 120:150 aspect. */
  fluid?: boolean;
};

// A cute 3D-style robot rendered in SVG: silver rounded helmet with a color
// stripe, dark face plate with big glowing eyes and a smile, ear pods, a
// chest core, and a neon platform disc it hovers over. Gradients fake the
// 3D shading. Each variant carries a floating holographic accessory that
// shows the agent's actual job.
export function RobotAgent({ variant, active, color, size = 120, fluid = false }: RobotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const metal = `metal-${uid}`;
  const metalHead = `metalHead-${uid}`;
  const glowGrad = `glow-${uid}`;
  const h = size * 1.25;

  return (
    // Fluid sizing uses the padding-percentage aspect-ratio technique, not
    // the `aspect-ratio` CSS property: a container sized with `aspect-ratio`
    // that holds an SVG child (a replaced element) has a Chromium quirk
    // where the resolved intrinsic size gets cached and never re-resolves on
    // pure browser zoom, freezing the robot at its first-rendered pixel
    // size while the rest of the page zooms normally.
    <div
      style={fluid ? { width: "100%", position: "relative", paddingTop: `${(150 / 120) * 100}%` } : { width: size, height: h }}
      className="relative"
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 120 150"
        fill="none"
        style={fluid ? { position: "absolute", inset: 0 } : undefined}
      >
        <defs>
          <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8eaf2" />
            <stop offset="45%" stopColor="#b6bccf" />
            <stop offset="100%" stopColor="#7e86a3" />
          </linearGradient>
          <radialGradient id={metalHead} cx="0.35" cy="0.3" r="1">
            <stop offset="0%" stopColor="#f4f6fb" />
            <stop offset="55%" stopColor="#b9bfd3" />
            <stop offset="100%" stopColor="#767e9d" />
          </radialGradient>
          <radialGradient id={glowGrad}>
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Platform disc */}
        <ellipse cx="60" cy="134" rx="42" ry="11" fill="#0b1020" stroke="#1e2740" strokeWidth="1.5" />
        <motion.ellipse
          cx="60"
          cy="134"
          rx="34"
          ry="8"
          stroke={color}
          strokeWidth="1.8"
          fill="none"
          animate={active ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.3 }}
          transition={active ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
        />
        <ellipse cx="60" cy="137.5" rx="42" ry="10" stroke={color} strokeOpacity={active ? 0.5 : 0.2} strokeWidth="1.2" fill="none" />
        {/* Under-glow between robot and platform */}
        {active ? <ellipse cx="60" cy="128" rx="24" ry="6" fill={`url(#${glowGrad})`} /> : null}

        {/* Hovering robot */}
        <motion.g
          animate={active ? { y: [0, -5, 0] } : { y: 0 }}
          transition={active ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
          style={{ filter: active ? `drop-shadow(0 0 10px ${color}55)` : "none" }}
        >
          {/* Legs */}
          <rect x="46" y="112" width="9" height="12" rx="4.5" fill={`url(#${metal})`} />
          <rect x="65" y="112" width="9" height="12" rx="4.5" fill={`url(#${metal})`} />

          {/* Arms */}
          <motion.g
            animate={active ? { rotate: [0, -6, 0] } : { rotate: 0 }}
            transition={active ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : {}}
            style={{ originX: "36px", originY: "88px" }}
          >
            <path d="M36 88 Q22 94 20 104" stroke={`url(#${metal})`} strokeWidth="9" strokeLinecap="round" fill="none" />
          </motion.g>
          <motion.g
            animate={active ? { rotate: [0, 8, 0] } : { rotate: 0 }}
            transition={active ? { duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 } : {}}
            style={{ originX: "84px", originY: "88px" }}
          >
            <path d="M84 88 Q98 92 100 100" stroke={`url(#${metal})`} strokeWidth="9" strokeLinecap="round" fill="none" />
          </motion.g>

          {/* Body */}
          <path d="M40 84 h40 q2 0 2 3 l-3 26 q-0.5 5 -6 5 h-26 q-5.5 0 -6 -5 l-3 -26 q0 -3 2 -3z" fill={`url(#${metal})`} stroke="#5d6584" strokeWidth="1" />
          {/* Belt line */}
          <line x1="38.5" y1="98" x2="81.5" y2="98" stroke="#4d5573" strokeWidth="2.5" strokeLinecap="round" />
          {/* Chest core */}
          <motion.circle
            cx="60"
            cy="91"
            r="5"
            fill={color}
            stroke="#0d1220"
            strokeWidth="1.5"
            animate={active ? { opacity: [0.6, 1, 0.6], scale: [1, 1.15, 1] } : { opacity: 0.35 }}
            transition={active ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : {}}
            style={{ originX: "60px", originY: "91px" }}
          />

          {/* Neck */}
          <rect x="54" y="76" width="12" height="8" rx="3" fill="#7e86a3" />

          {/* Ear pods */}
          <circle cx="26" cy="48" r="8" fill={`url(#${metal})`} stroke="#5d6584" strokeWidth="1" />
          <motion.circle cx="26" cy="48" r="4" fill={color} animate={active ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.35 }} transition={active ? { duration: 2, repeat: Infinity } : {}} />
          <circle cx="94" cy="48" r="8" fill={`url(#${metal})`} stroke="#5d6584" strokeWidth="1" />
          <motion.circle cx="94" cy="48" r="4" fill={color} animate={active ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.35 }} transition={active ? { duration: 2, repeat: Infinity, delay: 0.4 } : {}} />

          {/* Head */}
          <circle cx="60" cy="46" r="30" fill={`url(#${metalHead})`} stroke="#5d6584" strokeWidth="1" />
          {/* Helmet stripe */}
          <path d="M46 20 Q60 14 74 20" stroke="#39415f" strokeWidth="5" strokeLinecap="round" fill="none" />
          <motion.circle
            cx="60"
            cy="17"
            r="3.4"
            fill={color}
            animate={active ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.4 }}
            transition={active ? { duration: 1.4, repeat: Infinity } : {}}
          />

          {/* Face plate */}
          <rect x="38" y="32" width="44" height="30" rx="12" fill="#141a2e" stroke="#2a3352" strokeWidth="1.5" />

          {/* Eyes */}
          {variant === "scout" ? (
            // Scout: scanning visor instead of eyes
            <>
              <rect x="43" y="40" width="34" height="10" rx="5" fill="#080c18" stroke={color} strokeOpacity="0.5" strokeWidth="1" />
              <motion.rect
                x="45"
                y="41.5"
                width="8"
                height="7"
                rx="3.5"
                fill={color}
                animate={active ? { x: [0, 22, 0] } : { x: 11 }}
                transition={active ? { duration: 1.9, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
              />
            </>
          ) : (
            <>
              <motion.circle
                cx="50"
                cy="44"
                r="5.5"
                fill={color}
                animate={active ? { opacity: [1, 1, 0.15, 1], scaleY: [1, 1, 0.2, 1] } : { opacity: 0.45 }}
                transition={active ? { duration: 3.4, repeat: Infinity, times: [0, 0.9, 0.94, 1] } : {}}
                style={{ originX: "50px", originY: "44px", filter: active ? `drop-shadow(0 0 4px ${color})` : "none" }}
              />
              <motion.circle
                cx="70"
                cy="44"
                r="5.5"
                fill={color}
                animate={active ? { opacity: [1, 1, 0.15, 1], scaleY: [1, 1, 0.2, 1] } : { opacity: 0.45 }}
                transition={active ? { duration: 3.4, repeat: Infinity, times: [0, 0.9, 0.94, 1] } : {}}
                style={{ originX: "70px", originY: "44px", filter: active ? `drop-shadow(0 0 4px ${color})` : "none" }}
              />
            </>
          )}
          {/* Smile */}
          <path d="M55 54 Q60 58 65 54" stroke={color} strokeOpacity={active ? 0.9 : 0.4} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* ——— Variant accessory: the agent's job, floating beside it ——— */}
        {variant === "scout" && (
          <motion.g
            animate={active ? { rotate: [-8, 8, -8], y: [0, -3, 0] } : { rotate: 0 }}
            transition={active ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : {}}
            style={{ originX: "103px", originY: "70px" }}
          >
            <circle cx="103" cy="66" r="8" stroke={color} strokeWidth="2.2" fill="#080c1866" />
            <line x1="108" y1="73" x2="114" y2="80" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
          </motion.g>
        )}

        {variant === "qualifier" && (
          <motion.g
            animate={active ? { y: [0, -4, 0], opacity: 1 } : { y: 0, opacity: 0.45 }}
            transition={active ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" } : {}}
          >
            <rect x="96" y="58" width="22" height="30" rx="4" fill="#080c18cc" stroke={color} strokeWidth="1.6" />
            {[0, 1, 2].map((i) => (
              <motion.line
                key={i}
                x1="100"
                y1={66 + i * 6}
                x2={i === 2 ? 108 : 114}
                y2={66 + i * 6}
                stroke={color}
                strokeWidth="1.8"
                strokeLinecap="round"
                animate={active ? { opacity: [0.2, 1, 0.2] } : { opacity: 0.5 }}
                transition={active ? { duration: 2.1, repeat: Infinity, delay: i * 0.35 } : {}}
              />
            ))}
            <motion.path
              d="M101 83l3 3 6-6"
              stroke={color}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              animate={active ? { opacity: [0, 0, 1, 1, 0] } : { opacity: 0.6 }}
              transition={active ? { duration: 2.8, repeat: Infinity, times: [0, 0.4, 0.6, 0.9, 1] } : {}}
            />
          </motion.g>
        )}

        {variant === "outreach" && (
          <motion.g
            animate={active ? { y: [0, -5, 0], opacity: [0.75, 1, 0.75] } : { y: 0, opacity: 0.45 }}
            transition={active ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : {}}
          >
            <rect x="94" y="62" width="26" height="18" rx="4" fill="#080c18cc" stroke={color} strokeWidth="1.8" />
            <path d="M95 64l12 8 12-8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </motion.g>
        )}

        {variant === "sequencer" && (
          <g>
            <path d="M98 60v10m0 0v10m0-10h14" stroke={color} strokeWidth="1.4" strokeOpacity="0.6" fill="none" />
            {[
              { cx: 98, cy: 60 },
              { cx: 98, cy: 80 },
              { cx: 112, cy: 70 },
            ].map((n, i) => (
              <motion.circle
                key={i}
                cx={n.cx}
                cy={n.cy}
                r="4.2"
                fill="#080c18"
                stroke={color}
                strokeWidth="1.8"
                animate={active ? { fill: ["#080c18", color, "#080c18"] } : { fill: "#080c18" }}
                transition={active ? { duration: 2.4, repeat: Infinity, delay: i * 0.8 } : {}}
              />
            ))}
          </g>
        )}

        {variant === "proposal" && (
          <g>
            <rect x="95" y="56" width="24" height="32" rx="4" fill="#080c18cc" stroke={color} strokeWidth="1.8" />
            {[13, 16, 10].map((w, i) => (
              <motion.line
                key={i}
                x1="99"
                y1={64 + i * 6}
                x2={99 + w}
                y2={64 + i * 6}
                stroke={color}
                strokeWidth="1.8"
                strokeLinecap="round"
                initial={{ pathLength: active ? 0 : 1 }}
                animate={active ? { pathLength: [0, 1, 1, 0] } : { pathLength: 1, opacity: 0.5 }}
                transition={active ? { duration: 3.2, repeat: Infinity, delay: i * 0.4, times: [0, 0.35, 0.85, 1] } : {}}
              />
            ))}
            <motion.circle
              cx="112"
              cy="83"
              r="3"
              fill={color}
              animate={active ? { opacity: [0, 0, 1, 0] } : { opacity: 0.4 }}
              transition={active ? { duration: 3.2, repeat: Infinity, times: [0, 0.5, 0.7, 1] } : {}}
            />
          </g>
        )}

        {variant === "analytics" && (
          <motion.g
            animate={active ? { y: [0, -3, 0] } : { y: 0, opacity: 0.5 }}
            transition={active ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : {}}
          >
            <rect x="94" y="58" width="26" height="22" rx="4" fill="#080c18cc" stroke={color} strokeWidth="1.6" />
            {[10, 6, 13].map((barH, i) => (
              <motion.rect
                key={i}
                x={99 + i * 6}
                y={76 - barH}
                width="4"
                height={barH}
                rx="1.5"
                fill={color}
                animate={active ? { height: [barH * 0.4, barH, barH * 0.4], y: [76 - barH * 0.4, 76 - barH, 76 - barH * 0.4] } : { height: barH, y: 76 - barH }}
                transition={active ? { duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" } : {}}
              />
            ))}
          </motion.g>
        )}
      </svg>
    </div>
  );
}
