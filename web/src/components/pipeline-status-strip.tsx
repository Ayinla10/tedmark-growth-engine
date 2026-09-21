"use client";

import type { PipelineStatus } from "@/lib/queries";

const STAGES = [
  { key: "raw",            label: "Scouted",       color: "#38bdf8" },
  { key: "enriched",       label: "Enriched",       color: "#818cf8" },
  { key: "qualified",      label: "Qualified",      color: "#a78bfa" },
  { key: "outreach_ready", label: "Outreach Ready", color: "#fbbf24" },
  { key: "contacted",      label: "Contacted",      color: "#34d399" },
  { key: "dead_end",       label: "Dead End",       color: "#f87171" },
  { key: "paused",         label: "Paused",         color: "#64748b" },
] as const;

export function PipelineStatusStrip({ status }: { status: PipelineStatus }) {
  const active = STAGES.filter((s) => status[s.key as keyof PipelineStatus] > 0);

  return (
    <div className="rounded-2xl border border-sky-500/15 bg-[#0a0f1e] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold tracking-[0.15em] text-slate-300 uppercase">
          Autonomous Pipeline
        </h3>
        <span className="text-[11px] text-slate-500">{status.total} total leads</span>
      </div>

      {/* Stage flow */}
      <div className="flex flex-wrap gap-2">
        {STAGES.map((stage, i) => {
          const count = status[stage.key as keyof PipelineStatus] as number;
          return (
            <div key={stage.key} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="text-slate-700 text-xs">→</span>
              )}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
                style={{
                  background: count > 0 ? `${stage.color}18` : "transparent",
                  borderColor: count > 0 ? `${stage.color}40` : "#1e293b",
                  color: count > 0 ? stage.color : "#475569",
                }}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: count > 0 ? `${stage.color}25` : "#1e293b",
                  }}
                >
                  {count}
                </span>
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active stages summary */}
      {active.length > 0 && (
        <p className="text-[11px] text-slate-500 mt-2.5">
          Pipeline is moving:{" "}
          {active
            .filter((s) => !["dead_end", "paused"].includes(s.key))
            .map((s) => `${status[s.key as keyof PipelineStatus]} in ${s.label}`)
            .join(", ") || "all quiet"}
          {status.dead_end > 0 && ` · ${status.dead_end} dead end${status.dead_end > 1 ? "s" : ""}`}
          {status.paused > 0 && ` · ${status.paused} paused`}
        </p>
      )}
    </div>
  );
}
