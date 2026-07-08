"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export function ScoringProtocol({ protocol }: { protocol: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-surface border border-border-c rounded-2xl p-4 mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-sm font-semibold text-ink"
      >
        Scoring protocol
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open ? (
        <pre className="text-xs text-ink-secondary whitespace-pre-wrap font-sans leading-relaxed mt-3">
          {protocol || "Scoring guide not found."}
        </pre>
      ) : (
        <p className="text-xs text-ink-muted mt-1">How the AI scores 1–10. Click to expand.</p>
      )}
    </div>
  );
}
