"use client";

import { motion } from "framer-motion";
import { JarvisFlowCore } from "./jarvis-flow-core";
import { RobotAgent } from "./robot-agent";

export type OrchestrationNode = {
  key: string;
  name: string;
  color: string;
  status: "completed" | "inprogress" | "pending";
  statusLabel: string;
  detail: string;
  order: number;
};

const RADIUS = 38; // percent of container
const CENTER = { x: 50, y: 50 };

// Six nodes evenly spaced 60° apart around the core, starting at the top and
// going clockwise — a symmetric hexagon, matching pipeline order 1→6.
function posFor(index: number, total: number) {
  const angle = (index / total) * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  return {
    x: CENTER.x + RADIUS * Math.cos(rad),
    y: CENTER.y + RADIUS * Math.sin(rad) * 0.86, // slight vertical compression for a wide canvas
  };
}

function ringPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = mx - CENTER.x;
  const dy = my - CENTER.y;
  const len = Math.hypot(dx, dy) || 1;
  const push = 6; // bow the curve outward, away from the core
  const cx = mx + (dx / len) * push;
  const cy = my + (dy / len) * push;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

export function OrchestrationCanvas({ nodes }: { nodes: OrchestrationNode[] }) {
  const positions = nodes.map((_, i) => posFor(i, nodes.length));

  return (
    <div className="relative w-full" style={{ paddingTop: "62%" }}>
      {/* Connection layer */}
      <svg viewBox="0 0 100 62" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {nodes.map((node, i) => {
          const next = nodes[(i + 1) % nodes.length];
          const a = positions[i];
          const b = positions[(i + 1) % nodes.length];
          const flowing = node.status !== "pending" && next.status !== "pending";
          const d = ringPath(a, b);
          return (
            <g key={`link-${node.key}`}>
              <path d={d} stroke={node.color} strokeOpacity={flowing ? 0.35 : 0.1} strokeWidth="0.35" strokeDasharray="0.6 1.4" fill="none" vectorEffect="non-scaling-stroke" />
              {flowing
                ? [0, 1].map((k) => (
                    <circle key={k} r={k === 0 ? 0.9 : 0.55} fill={node.color} opacity={k === 0 ? 0.95 : 0.55}>
                      <animateMotion dur="2.2s" begin={`${k * 0.9}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  ))
                : null}
            </g>
          );
        })}
      </svg>

      {/* Central core */}
      <div
        className="absolute flex flex-col items-center"
        style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%`, transform: "translate(-50%, -50%)", width: "26%" }}
      >
        <JarvisFlowCore />
        <p className="text-[10px] tracking-[0.25em] text-sky-300/90 font-semibold -mt-1 whitespace-nowrap">J.A.R.V.I.S CORE</p>
        <p className="text-[9px] text-slate-400 whitespace-nowrap">Listening &middot; Analyzing &middot; Coordinating</p>
      </div>

      {/* Agent nodes */}
      {nodes.map((node, i) => {
        const p = positions[i];
        return (
          <motion.div
            key={node.key}
            className="absolute flex flex-col items-center text-center"
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -50%)", width: "17%" }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: node.order * 0.08, ease: "easeOut" }}
          >
            <div className="relative w-full">
              <span
                className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border"
                style={{ background: "#0d1220", borderColor: `${node.color}88`, color: node.color }}
              >
                {node.order}
              </span>
              <RobotAgent active={node.status !== "pending"} color={node.color} fluid />
            </div>
            <p className="text-[13px] font-semibold text-slate-100 mt-1 whitespace-nowrap">{node.name}</p>
            <p className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: node.status === "pending" ? "#64748b" : node.color }}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${node.status === "inprogress" ? "animate-pulse" : ""}`}
                style={{ background: node.status === "pending" ? "#64748b" : node.color }}
              />
              {node.statusLabel}
            </p>
            <p className="text-[10px] text-slate-400 leading-snug mt-0.5 line-clamp-2 max-w-[140px]">{node.detail}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
