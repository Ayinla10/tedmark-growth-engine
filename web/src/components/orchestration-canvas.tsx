"use client";

import { motion } from "framer-motion";
import { JarvisLottie } from "./jarvis-lottie";
import { RobotAgent, type RobotVariant } from "./robot-agent";

export type OrchestrationNode = {
  variant: RobotVariant;
  name: string;
  color: string;
  status: "completed" | "inprogress" | "pending";
  statusLabel: string;
  detail: string;
  order: number;
};

// ——————————————————————————————————————————————————————————————
// Layout is fully computed from one center point + one shared ellipse
// radius. No node is ever hand-positioned: each agent gets an angle that is
// exactly 360/N degrees apart from its neighbors, starting at the top
// (-90°) and proceeding clockwise. Moving an agent in AGENT_ORDER reflows
// the whole ring automatically — nothing below needs to change.
//
// Everything here is sized with plain percentages and Tailwind's rem-based
// text classes — the same units the rest of the app already uses, and the
// only units that reliably scale with real browser zoom. (A JS-measured
// ResizeObserver + transform: scale() was tried here and made things worse:
// it computed scale from the element's un-zoomed logical width, which
// grows on zoom-out, and re-applying that as a counter-scale canceled out
// the browser's own zoom shrink — the opposite of the intended fix.)
// ——————————————————————————————————————————————————————————————
const W = 1000;
const H = 700;
const CX = W / 2;
const CY = 330;
const RX = 350;
const RY = 220;

// Pipeline order — this is the only place agent order is decided.
const AGENT_ORDER: RobotVariant[] = ["scout", "qualifier", "outreach", "sequencer", "proposal", "analytics"];

const TOP_DEG = -90;
const STEP_DEG = 360 / AGENT_ORDER.length;

// angle(i) = TOP_DEG + i * STEP_DEG — one agent sits exactly at the top,
// the rest fall out symmetrically at equal angular spacing.
const ANGLES: Record<RobotVariant, number> = Object.fromEntries(
  AGENT_ORDER.map((variant, i) => [variant, TOP_DEG + i * STEP_DEG])
) as Record<RobotVariant, number>;

function pointAt(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: Number((CX + RX * Math.cos(rad)).toFixed(2)),
    y: Number((CY + RY * Math.sin(rad)).toFixed(2)),
  };
}

// Elliptical arc between two ring angles, always the short way round
// (large-arc-flag=0) and clockwise (sweep-flag=1) to match increasing angle.
function arcPath(fromDeg: number, toDeg: number): string {
  const a = pointAt(fromDeg);
  const b = pointAt(toDeg);
  const largeArcFlag = 0;
  const sweepFlag = 1;
  return `M ${a.x} ${a.y} A ${RX} ${RY} 0 ${largeArcFlag} ${sweepFlag} ${b.x} ${b.y}`;
}

// Tangent direction (in degrees) of the ellipse at a given angle, derived
// from the parametric derivative — used to orient the arrowhead so it
// always points along the arc instead of a fixed rotation.
function tangentDegAt(deg: number): number {
  const rad = (deg * Math.PI) / 180;
  const dx = -RX * Math.sin(rad);
  const dy = RY * Math.cos(rad);
  // Fixed precision keeps server- and client-rendered rotate() strings
  // identical, avoiding hydration mismatches from float rounding.
  return Number(((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(2));
}

const STATUS_COLORS = {
  completed: "#22c55e",
  inprogress: "#f59e0b",
  pending: "#64748b",
} as const;

export function OrchestrationCanvas({ nodes }: { nodes: OrchestrationNode[] }) {
  const byVariant = Object.fromEntries(nodes.map((n) => [n.variant, n])) as Record<RobotVariant, OrchestrationNode>;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      {/* Connection layer */}
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" fill="none">
        <defs>
          <filter id="link-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Faint full ring underlay so the circle reads even where idle */}
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} stroke="#38bdf8" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="2 8" />

        {/* Spokes from core to each agent */}
        {AGENT_ORDER.map((v) => {
          const p = pointAt(ANGLES[v]);
          const active = byVariant[v]?.status !== "pending";
          return (
            <line
              key={`spoke-${v}`}
              x1={CX}
              y1={CY}
              x2={p.x}
              y2={p.y}
              stroke="#38bdf8"
              strokeOpacity={active ? 0.1 : 0.04}
              strokeWidth="1"
              strokeDasharray="2 6"
            />
          );
        })}

        {/* Circling handoff arcs: N equal ellipse segments closing the loop.
            Each arrowhead is an explicit triangle rotated to the arc's
            tangent at its midpoint, so it always points along the curve. */}
        {AGENT_ORDER.map((v, i) => {
          const next = AGENT_ORDER[(i + 1) % AGENT_ORDER.length];
          const from = byVariant[v];
          const to = byVariant[next];
          const flowing = from?.status !== "pending" && to?.status !== "pending";
          const fromDeg = ANGLES[v];
          const toDeg = fromDeg + STEP_DEG;
          const d = arcPath(fromDeg, toDeg);
          const midDeg = fromDeg + STEP_DEG / 2;
          const mid = pointAt(midDeg);
          const tangentDeg = tangentDegAt(midDeg);

          return (
            <g key={`link-${v}`}>
              <path
                d={d}
                stroke={from.color}
                strokeOpacity={flowing ? 0.75 : 0.15}
                strokeWidth={flowing ? 2.2 : 1.5}
                strokeDasharray="1 10"
                strokeLinecap="round"
                filter={flowing ? "url(#link-glow)" : undefined}
              />
              <polygon
                points="-6,-4.5 6,0 -6,4.5"
                fill={from.color}
                opacity={flowing ? 1 : 0.25}
                transform={`translate(${mid.x} ${mid.y}) rotate(${tangentDeg})`}
              />
              {flowing
                ? [0, 1].map((k) => (
                    <circle key={k} r={k === 0 ? 4 : 2.5} fill={from.color} opacity={k === 0 ? 0.95 : 0.55} filter="url(#link-glow)">
                      <animateMotion dur="3s" begin={`${k * 1.1}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  ))
                : null}
            </g>
          );
        })}
      </svg>

      {/* Central core — Lottie centered exactly on (CX, CY), the same
          center every ring position is computed from. No offset/margin. */}
      <div
        className="absolute"
        style={{ left: `${(CX / W) * 100}%`, top: `${(CY / H) * 100}%`, transform: "translate(-50%, -50%)", width: "26%" }}
      >
        <JarvisLottie />
      </div>
      <div
        className="absolute flex flex-col items-center text-center"
        style={{ left: `${(CX / W) * 100}%`, top: `${((CY + 135) / H) * 100}%`, transform: "translate(-50%, 0)" }}
      >
        <p className="text-amber-300/90 font-semibold text-[0.7rem] sm:text-xs tracking-[0.3em] whitespace-nowrap">
          J.A.R.V.I.S CORE
        </p>
        <p className="text-slate-400 text-[0.6rem] sm:text-[0.7rem] whitespace-nowrap">
          Listening, analyzing &amp; orchestrating
        </p>
      </div>

      {/* Agent nodes — one shared style block, all identical in size, icon
          scale, and badge/label offset. Only position (left/top) differs,
          and that position comes entirely from pointAt(ANGLES[variant]). */}
      {nodes.map((node) => {
        const p = pointAt(ANGLES[node.variant]);
        const statusColor = STATUS_COLORS[node.status];
        return (
          <motion.div
            key={node.variant}
            className="absolute flex flex-col items-center text-center"
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, transform: "translate(-50%, -50%)", width: "19%" }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: node.order * 0.1, ease: "easeOut" }}
          >
            <div className="relative" style={{ width: "55%" }}>
              <span
                className="absolute rounded-full font-bold flex items-center justify-center border text-[0.55rem] sm:text-[0.65rem]"
                style={{
                  top: "-2%",
                  right: "-6%",
                  width: "1.1rem",
                  height: "1.1rem",
                  background: "#0d1220",
                  borderColor: `${node.color}88`,
                  color: node.color,
                }}
              >
                {node.order}
              </span>
              <RobotAgent variant={node.variant} active={node.status !== "pending"} color={node.color} fluid />
            </div>
            <p className="font-semibold text-slate-100 mt-1 text-xs sm:text-sm whitespace-nowrap">
              {node.name}
            </p>
            <p className="font-medium flex items-center gap-1.5 text-[0.65rem] sm:text-xs whitespace-nowrap" style={{ color: statusColor }}>
              <span
                className={`rounded-full w-1.5 h-1.5 ${node.status === "inprogress" ? "animate-pulse" : ""}`}
                style={{ background: statusColor }}
              />
              {node.statusLabel}
            </p>
            <p className="text-slate-400 leading-snug mt-0.5 line-clamp-2 text-[0.6rem] sm:text-[0.7rem]">
              {node.detail}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
