"use client";

import { useTransition, useState } from "react";
import { ChevronDown } from "lucide-react";
import { updatePipelineAction } from "@/lib/actions";

const PIPELINE_STAGES = ["New","Contacted","Qualified","Proposal Sent","Negotiating","Won","Lost"] as const;

const STAGE_COLOR: Record<string, string> = {
  New:            "#6b9fff",
  Contacted:      "#b45309",
  Qualified:      "#065f46",
  "Proposal Sent":"#92400e",
  Negotiating:    "#5b21b6",
  Won:            "#14532d",
  Lost:           "#991b1b",
};
const STAGE_BG: Record<string, string> = {
  New:            "rgba(107,159,255,0.12)",
  Contacted:      "rgba(251,191,36,0.12)",
  Qualified:      "rgba(52,211,153,0.12)",
  "Proposal Sent":"rgba(245,158,11,0.12)",
  Negotiating:    "rgba(167,139,250,0.12)",
  Won:            "rgba(34,197,94,0.12)",
  Lost:           "rgba(239,68,68,0.10)",
};

export function StageSwitcher({ leadId, currentStage }: { leadId: string; currentStage: string }) {
  const [stage, setStage] = useState(currentStage);
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setStage(next);
    startTransition(async () => {
      await updatePipelineAction(leadId, { pipelineStage: next });
    });
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={stage}
        onChange={handleChange}
        disabled={pending}
        className="appearance-none text-xs font-semibold px-2.5 pr-6 py-1 rounded-full cursor-pointer transition-opacity disabled:opacity-60"
        style={{
          background: STAGE_BG[stage] ?? "var(--surface-2)",
          color: STAGE_COLOR[stage] ?? "var(--ink-muted)",
          border: `1px solid ${STAGE_COLOR[stage] ?? "var(--border-c)"}40`,
        }}
      >
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s} style={{ background: "var(--surface)", color: "var(--ink)" }}>
            {s}
          </option>
        ))}
      </select>
      <ChevronDown
        size={10}
        className="pointer-events-none absolute right-1.5"
        style={{ color: STAGE_COLOR[stage] ?? "var(--ink-muted)" }}
      />
    </div>
  );
}
