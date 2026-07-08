"use client";

import { FileText } from "lucide-react";
import { useState, useTransition } from "react";
import { runProposalAction } from "@/lib/actions";
import { Modal, ResultBanner } from "./modal";
import type { AgentRunResult } from "@/lib/runAgent";

const SERVICE_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "seo", label: "SEO" },
  { value: "ads", label: "Ads" },
  { value: "automation", label: "Automation" },
  { value: "ai-chatbot", label: "AI chatbot" },
];

const BUDGET_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "mid", label: "Medium" },
  { value: "high", label: "High" },
];

export function ProposalWizard({ leads }: { leads: { id: string; business_name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [leadId, setLeadId] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [budget, setBudget] = useState("mid");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AgentRunResult | null>(null);

  function reset() {
    setStep(1);
    setLeadId("");
    setServices([]);
    setBudget("mid");
    setResult(null);
  }

  function toggleService(value: string) {
    setServices((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="bg-brand text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:shadow-lg transition-all"
      >
        <FileText size={16} /> New proposal
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`New proposal — step ${step} of 3`}>
        {step === 1 && (
          <div className="space-y-3">
            <label className="text-xs text-ink-secondary block">Choose lead</label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="w-full">
              <option value="">Select a lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!leadId}
              onClick={() => setStep(2)}
              className="w-full bg-brand text-white py-2 rounded-lg text-sm disabled:opacity-60"
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <label className="text-xs text-ink-secondary block">Choose services</label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_OPTIONS.map((s) => (
                <label
                  key={s.value}
                  className={`flex items-center gap-2 text-sm p-2 rounded-lg border cursor-pointer ${
                    services.includes(s.value) ? "border-brand bg-brand/10" : "border-border-c"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={services.includes(s.value)}
                    onChange={() => toggleService(s.value)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-2 rounded-lg text-sm border border-border-c">
                Back
              </button>
              <button
                type="button"
                disabled={services.length === 0}
                onClick={() => setStep(3)}
                className="flex-1 bg-brand text-white py-2 rounded-lg text-sm disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <label className="text-xs text-ink-secondary block">Budget range</label>
            <div className="grid grid-cols-3 gap-2">
              {BUDGET_OPTIONS.map((b) => (
                <label
                  key={b.value}
                  className={`text-center text-sm p-2 rounded-lg border cursor-pointer ${
                    budget === b.value ? "border-brand bg-brand/10" : "border-border-c"
                  }`}
                >
                  <input
                    type="radio"
                    name="budget"
                    className="hidden"
                    checked={budget === b.value}
                    onChange={() => setBudget(b.value)}
                  />
                  {b.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-2 rounded-lg text-sm border border-border-c">
                Back
              </button>
              <button
                type="button"
                disabled={pending}
                className="flex-1 bg-brand text-white py-2 rounded-lg text-sm disabled:opacity-60"
                onClick={() =>
                  startTransition(async () => {
                    setResult(null);
                    const r = await runProposalAction(leadId, services, budget);
                    setResult(r);
                  })
                }
              >
                {pending ? "Generating…" : "Generate"}
              </button>
            </div>
            {result ? <ResultBanner ok={result.ok} output={result.output} /> : null}
          </div>
        )}
      </Modal>
    </>
  );
}
