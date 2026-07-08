"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { runQualifierAction, runOutreachAction, runSequencerAction } from "@/lib/actions";
import { ResultBanner } from "./modal";

type AgentAction = "qualify" | "outreach" | "sequence";

export function AgentRunButton({
  label,
  runningLabel,
  action,
  limit,
  variant = "secondary",
  className,
  icon,
}: {
  label: string;
  runningLabel?: string;
  action: AgentAction;
  limit?: number;
  variant?: "primary" | "secondary";
  className?: string;
  icon?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; output?: string } | null>(null);

  const cls =
    className ??
    (variant === "primary"
      ? "bg-brand text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:shadow-lg transition-all disabled:opacity-60"
      : "glass px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-ink hover:bg-surface-2 transition-all disabled:opacity-60");

  async function run() {
    if (action === "qualify") return runQualifierAction(limit ?? 10);
    if (action === "outreach") return runOutreachAction(limit ?? 10);
    return runSequencerAction();
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={cls}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const r = await run();
            setResult(r);
          })
        }
      >
        {icon}
        {pending ? (runningLabel ?? "Running…") : label}
      </button>
      {result ? <ResultBanner ok={result.ok} output={result.output ?? ""} /> : null}
    </div>
  );
}
