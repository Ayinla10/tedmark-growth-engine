"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ChevronRight, Loader2, XCircle } from "lucide-react";
import { updatePipelineAction } from "@/lib/actions";

const ACTIVE_STAGES = ["Qualified", "Proposal Sent", "Negotiating"] as const;

const STAGE_CONF: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  Qualified:       { dot: "rgb(107,159,255)", bg: "rgba(107,159,255,0.10)", border: "rgba(107,159,255,0.30)", text: "rgb(80,120,230)" },
  "Proposal Sent": { dot: "rgb(168,85,247)",  bg: "rgba(168,85,247,0.10)",  border: "rgba(168,85,247,0.30)",  text: "rgb(126,34,206)" },
  Negotiating:     { dot: "rgb(245,158,11)",  bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.30)",  text: "rgb(161,98,7)" },
  Won:             { dot: "rgb(34,197,94)",   bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.30)",   text: "rgb(21,128,61)" },
  Lost:            { dot: "rgb(239,68,68)",   bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   text: "rgb(185,28,28)" },
};

type Props = {
  dealId: string;
  currentStage: string;
};

export function DealStageChanger({ dealId, currentStage }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmClose, setConfirmClose] = useState<"Won" | "Lost" | null>(null);
  const [moved, setMoved] = useState(false);

  function move(stage: string) {
    startTransition(async () => {
      await updatePipelineAction(dealId, { pipelineStage: stage });
      setMoved(true);
      setConfirmClose(null);
    });
  }

  if (moved) {
    return (
      <p className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
        Stage updated — reload to see changes.
      </p>
    );
  }

  if (confirmClose) {
    const conf = STAGE_CONF[confirmClose];
    const isWon = confirmClose === "Won";
    return (
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: conf.bg, border: `1px solid ${conf.border}` }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Mark deal as {confirmClose}?
        </p>
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {isWon
            ? "This will move the deal to Won and remove it from the active pipeline."
            : "This will move the deal to Lost and remove it from the active pipeline."}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => move(confirmClose)}
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: conf.dot, color: "#fff" }}
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : null}
            Confirm — Mark {confirmClose}
          </button>
          <button
            onClick={() => setConfirmClose(null)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--surface)", color: "var(--ink-muted)", border: "1px solid var(--border-c)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Active stage buttons */}
      <div className="flex flex-wrap gap-2">
        {ACTIVE_STAGES.filter(s => s !== currentStage).map(stage => {
          const conf = STAGE_CONF[stage];
          return (
            <button
              key={stage}
              onClick={() => move(stage)}
              disabled={pending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
              style={{
                background: conf.bg,
                color: conf.text,
                border: `1px solid ${conf.border}`,
                opacity: pending ? 0.6 : 1,
              }}
            >
              {pending ? <Loader2 size={10} className="animate-spin" /> : <ChevronRight size={10} />}
              Move to {stage}
            </button>
          );
        })}
      </div>

      {/* Won / Lost */}
      {currentStage !== "Won" && currentStage !== "Lost" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setConfirmClose("Won")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(34,197,94,0.10)", color: "rgb(21,128,61)", border: "1px solid rgba(34,197,94,0.25)" }}
          >
            <CheckCircle2 size={11} /> Mark Won
          </button>
          <button
            onClick={() => setConfirmClose("Lost")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(239,68,68,0.08)", color: "rgb(185,28,28)", border: "1px solid rgba(239,68,68,0.20)" }}
          >
            <XCircle size={11} /> Mark Lost
          </button>
        </div>
      )}

      {/* Reopen if Won/Lost */}
      {(currentStage === "Won" || currentStage === "Lost") && (
        <button
          onClick={() => move("Negotiating")}
          disabled={pending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "var(--surface-2)", color: "var(--ink-muted)", border: "1px solid var(--border-c)" }}
        >
          {pending ? <Loader2 size={10} className="animate-spin" /> : null}
          Reopen deal
        </button>
      )}
    </div>
  );
}
