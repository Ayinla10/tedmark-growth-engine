"use client";

import { useState, useTransition } from "react";
import { PauseCircle, PlayCircle } from "lucide-react";
import { setLeadPipelinePausedAction } from "@/lib/actions";

export function PipelinePauseButton({
  leadId,
  paused,
}: {
  leadId: string;
  paused: boolean;
}) {
  const [isPaused, setIsPaused] = useState(paused);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isPaused;
    startTransition(async () => {
      await setLeadPipelinePausedAction(leadId, next);
      setIsPaused(next);
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={isPaused ? "Resume pipeline for this lead" : "Pause pipeline for this lead"}
      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50"
      style={
        isPaused
          ? { background: "rgba(251,191,36,0.1)", color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)" }
          : { background: "rgba(100,116,139,0.08)", color: "#94a3b8", borderColor: "rgba(100,116,139,0.2)" }
      }
    >
      {isPaused ? (
        <><PlayCircle size={13} /> Resume pipeline</>
      ) : (
        <><PauseCircle size={13} /> Pause pipeline</>
      )}
    </button>
  );
}
