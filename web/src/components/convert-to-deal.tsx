"use client";

import { useState, useTransition } from "react";
import { Briefcase, ChevronRight, Loader2, X } from "lucide-react";
import { convertToDealAction } from "@/lib/actions";

const STAGES = ["Qualified", "Proposal Sent", "Negotiating"] as const;

const CURRENCIES = ["GH₵", "USD", "EUR", "GBP"];

const STAGE_CONF: Record<string, { bg: string; border: string; text: string }> = {
  Qualified:       { bg: "rgba(107,159,255,0.10)", border: "rgba(107,159,255,0.30)", text: "rgb(80,120,230)" },
  "Proposal Sent": { bg: "rgba(168,85,247,0.10)",  border: "rgba(168,85,247,0.30)",  text: "rgb(126,34,206)" },
  Negotiating:     { bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.30)",  text: "rgb(161,98,7)" },
};

type Props = {
  leadId: string;
  businessName: string;
  currentStage: string;
};

export function ConvertToDeal({ leadId, businessName, currentStage }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<string>("Qualified");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("GH₵");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isDeal = ["Qualified", "Proposal Sent", "Negotiating", "Won", "Lost"].includes(currentStage);

  function handleSubmit() {
    setError(null);
    const numValue = value.trim() ? parseFloat(value.replace(/,/g, "")) : null;
    if (value.trim() && (isNaN(numValue!) || numValue! <= 0)) {
      setError("Enter a valid deal value or leave it blank.");
      return;
    }
    startTransition(async () => {
      const res = await convertToDealAction(leadId, numValue, currency, stage);
      if (res.ok) {
        setOpen(false);
        setValue("");
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  if (isDeal) {
    return (
      <a
        href="/deals"
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
        style={{ background: "rgba(107,159,255,0.10)", color: "var(--brand)", border: "1px solid rgba(107,159,255,0.25)" }}
      >
        <Briefcase size={11} /> In deals
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: "rgba(107,159,255,0.10)", color: "var(--brand)", border: "1px solid rgba(107,159,255,0.25)" }}
      >
        <Briefcase size={11} /> Convert to deal
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--ink)" }}>Convert to deal</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>{businessName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg"
                style={{ color: "var(--ink-muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Stage */}
            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: "var(--ink-muted)" }}>
                Stage
              </label>
              <div className="flex gap-2 flex-wrap">
                {STAGES.map(s => {
                  const conf = STAGE_CONF[s];
                  const active = stage === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStage(s)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: active ? conf.bg : "var(--surface-2)",
                        color: active ? conf.text : "var(--ink-muted)",
                        border: active ? `1.5px solid ${conf.border}` : "1.5px solid transparent",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Deal value */}
            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: "var(--ink-muted)" }}>
                Deal value <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>(optional)</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="rounded-lg px-2 py-2 text-xs font-semibold flex-shrink-0"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                    border: "1px solid var(--border-c)",
                    outline: "none",
                  }}
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 25000"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                    border: "1px solid var(--border-c)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {error && (
              <p className="text-xs" style={{ color: "rgb(185,28,28)" }}>{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-opacity"
                style={{ background: "var(--brand)", color: "#fff", opacity: pending ? 0.7 : 1 }}
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                Add to pipeline
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--surface-2)", color: "var(--ink-muted)", border: "1px solid var(--border-c)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
