"use client";

import { useEffect, useRef } from "react";
import type { SectorStat } from "@/lib/queries";

/* ── Donut chart — funnel stages ───────────────────────────────────────── */
export function FunnelDonut({
  raw,
  qualified,
  contacted,
  archived,
}: {
  raw: number;
  qualified: number;
  contacted: number;
  archived: number;
}) {
  const total = raw + qualified + contacted + archived || 1;
  const slices = [
    { label: "Raw leads",  value: raw,       color: "var(--donut-a)" },
    { label: "Qualified",  value: qualified, color: "var(--donut-b)" },
    { label: "Contacted",  value: contacted, color: "var(--donut-c)" },
    { label: "Archived",   value: archived,  color: "var(--donut-d)" },
  ];

  const r = 54;
  const cx = 70;
  const cy = 70;
  const stroke = 20;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const paths = slices.map((s) => {
    const pct = s.value / total;
    const dash = pct * circ;
    const gap = circ - dash;
    const el = (
      <circle
        key={s.label}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={s.color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset * circ}
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    );
    offset += pct;
    return el;
  });

  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
        {paths}
      </svg>
      <div className="space-y-2.5 flex-1">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span style={{ color: "var(--ink-secondary)" }}>{s.label}</span>
            </div>
            <span className="font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Area/line chart — leads over 30 days ──────────────────────────────── */
export function TrendChart({
  data,
}: {
  data: { day: string; found: number; qualified: number }[];
}) {
  const W = 500;
  const H = 160;
  const PAD = { top: 12, right: 12, bottom: 28, left: 32 };

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--ink-muted)" }}>
        Not enough data yet — leads appear here as the pipeline runs.
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.found), 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xStep = innerW / (data.length - 1);

  function toX(i: number) { return PAD.left + i * xStep; }
  function toY(v: number) { return PAD.top + innerH - (v / maxVal) * innerH; }

  function polyline(key: "found" | "qualified") {
    return data.map((d, i) => `${toX(i)},${toY(d[key])}`).join(" ");
  }

  function area(key: "found" | "qualified") {
    const pts = data.map((d, i) => `${toX(i)},${toY(d[key])}`).join(" ");
    const last = `${toX(data.length - 1)},${PAD.top + innerH}`;
    const first = `${toX(0)},${PAD.top + innerH}`;
    return `${pts} ${last} ${first}`;
  }

  // Y grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const y = PAD.top + innerH - pct * innerH;
    const label = Math.round(pct * maxVal);
    return { y, label };
  });

  // X labels — show first, middle, last
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", overflow: "visible" }}
      aria-label="Leads trend over 30 days"
    >
      <defs>
        <linearGradient id="grad-found" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-qual" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.40" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {gridLines.map(({ y, label }) => (
        <g key={y}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--border-c)" strokeWidth="1" />
          <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="10" fill="var(--ink-muted)">{label}</text>
        </g>
      ))}

      {/* Found area + line */}
      <polygon points={area("found")} fill="url(#grad-found)" />
      <polyline
        points={polyline("found")}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="1.5"
        strokeOpacity="0.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Qualified area + line */}
      <polygon points={area("qualified")} fill="url(#grad-qual)" />
      <polyline
        points={polyline("qualified")}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Endpoint dot */}
      <circle
        cx={toX(data.length - 1)}
        cy={toY(data[data.length - 1].qualified)}
        r="4"
        fill="var(--brand)"
      />

      {/* X labels */}
      {xLabels.map((i) => (
        <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--ink-muted)">
          {data[i].day}
        </text>
      ))}
    </svg>
  );
}

/* ── Horizontal bar chart — sectors ────────────────────────────────────── */
export function SectorBars({ sectors }: { sectors: SectorStat[] }) {
  const max = Math.max(...sectors.map((s) => s.count), 1);

  if (sectors.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: "var(--ink-muted)" }}>
        No sector data yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sectors.map((s, i) => (
        <div key={s.sector}>
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--ink-secondary)" }}>
            <span className="capitalize truncate max-w-[140px]">{s.sector}</span>
            <span className="font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{s.count}</span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(s.count / max) * 100}%`,
                background: `color-mix(in srgb, var(--brand) ${100 - i * 10}%, transparent)`,
                transition: `width 0.5s ease ${i * 0.05}s`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Mini sparkline for KPI cards ──────────────────────────────────────── */
export function Sparkline({ up }: { up: boolean }) {
  const points = up
    ? "0,18 8,14 16,16 24,10 32,12 40,6 48,8 56,2"
    : "0,4 8,8 16,6 24,12 32,10 40,14 48,12 56,18";
  return (
    <svg width="56" height="20" viewBox="0 0 56 20" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
