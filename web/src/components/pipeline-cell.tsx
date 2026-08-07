"use client";

import { useState, useTransition } from "react";
import { updatePipelineAction } from "@/lib/actions";

const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiating",
  "Won",
  "Lost",
] as const;

const STAGE_STYLES: Record<string, string> = {
  New: "bg-surface-2 text-ink-secondary",
  Contacted: "bg-blue-500/10 text-blue-400",
  Qualified: "bg-brand/10 text-brand",
  "Proposal Sent": "bg-amber-500/10 text-amber-400",
  Negotiating: "bg-purple-500/10 text-purple-400",
  Won: "bg-green-500/10 text-green-400",
  Lost: "bg-red-500/10 text-red-400",
};

export function PipelineCell({
  leadId,
  pipelineStage,
  nextAction,
  nextActionDue,
}: {
  leadId: string;
  pipelineStage: string;
  nextAction: string | null;
  nextActionDue: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState(pipelineStage);
  const [action, setAction] = useState(nextAction ?? "");
  const [due, setDue] = useState(nextActionDue ?? "");
  const [editingAction, setEditingAction] = useState(false);

  const isOverdue = Boolean(due) && due < new Date().toISOString().slice(0, 10);

  function commitStage(newStage: string) {
    setStage(newStage);
    startTransition(() => {
      updatePipelineAction(leadId, { pipelineStage: newStage });
    });
  }

  function commitActionAndDue() {
    setEditingAction(false);
    startTransition(() => {
      updatePipelineAction(leadId, {
        nextAction: action.trim() === "" ? null : action.trim(),
        nextActionDue: due.trim() === "" ? null : due.trim(),
      });
    });
  }

  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <select
        value={stage}
        disabled={pending}
        onChange={(e) => commitStage(e.target.value)}
        className={`text-xs font-medium rounded-md px-2 py-1 border-0 outline-none cursor-pointer disabled:opacity-50 ${STAGE_STYLES[stage] ?? "bg-surface-2 text-ink-secondary"}`}
      >
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s} className="bg-surface-1 text-ink-primary">
            {s}
          </option>
        ))}
      </select>

      {editingAction ? (
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Next action…"
            className="text-xs rounded-md px-2 py-1 bg-surface-2 border border-border-c outline-none"
            autoFocus
          />
          <div className="flex gap-1">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="text-xs rounded-md px-2 py-1 bg-surface-2 border border-border-c outline-none flex-1"
            />
            <button
              type="button"
              onClick={commitActionAndDue}
              className="text-xs px-2 py-1 rounded-md bg-brand text-white"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditingAction(true)}
          className="text-left text-xs text-ink-muted hover:text-ink-secondary"
        >
          {nextAction ? (
            <span className={isOverdue ? "text-red-400 font-medium" : ""}>
              {nextAction}
              {nextActionDue ? ` — ${nextActionDue}${isOverdue ? " (overdue)" : ""}` : ""}
            </span>
          ) : (
            "+ set next action"
          )}
        </button>
      )}
    </div>
  );
}
