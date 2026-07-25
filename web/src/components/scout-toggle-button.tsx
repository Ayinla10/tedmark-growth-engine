"use client";

import { Pause, Play } from "lucide-react";
import { useState, useTransition } from "react";
import { setScoutEnabledAction } from "@/lib/actions";
import { ResultBanner } from "./modal";

// Pauses/resumes only the Maps-based Scout in the daily automated
// pipeline — a manual "Run Scout" (RunScoutModal) still works regardless
// of this toggle, since that's a one-off run, not the schedule.
export function ScoutToggleButton({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; output?: string } | null>(null);

  function toggle() {
    const next = !enabled;
    startTransition(async () => {
      const r = await setScoutEnabledAction(next);
      if (r.ok) setEnabled(next);
      setResult(r);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        title={enabled ? "Stop Scout in the daily automation" : "Resume Scout in the daily automation"}
        className={
          enabled
            ? "bg-[#0d1220] border border-slate-600/50 text-slate-100 px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-red-950/40 hover:border-red-500/50 transition-all disabled:opacity-60"
            : "bg-[#0d1220] border border-green-600/50 text-green-400 px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-green-950/40 transition-all disabled:opacity-60"
        }
      >
        {enabled ? <Pause size={15} /> : <Play size={15} />}
        {pending ? "Updating…" : enabled ? "Stop Scout" : "Resume Scout"}
      </button>
      {result ? <ResultBanner ok={result.ok} output={result.output ?? ""} /> : null}
    </div>
  );
}
