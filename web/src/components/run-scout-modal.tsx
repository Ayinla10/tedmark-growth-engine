"use client";

import { Play, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { runScoutAction } from "@/lib/actions";
import { Modal, ResultBanner } from "./modal";
import type { AgentRunResult } from "@/lib/runAgent";

// `command` renders the trigger in the dark outlined command-center style
// with a play icon, matching the AI Orchestrator page.
export function RunScoutModal({ command = false }: { command?: boolean }) {
  const [open, setOpen] = useState(false);
  const [sector, setSector] = useState("restaurant");
  const [city, setCity] = useState("Accra");
  const [limit, setLimit] = useState(20);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AgentRunResult | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          command
            ? "bg-[#0d1220] border border-slate-600/50 text-slate-100 px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-[#141b30] hover:border-slate-500/60 transition-all"
            : "bg-brand text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:shadow-lg transition-all"
        }
      >
        {command ? <Play size={15} /> : <Search size={16} />} Run Scout
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Run scout">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-secondary block mb-1">Sector</label>
            <select value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="restaurant">Restaurant</option>
              <option value="school">School</option>
              <option value="clinic">Clinic</option>
              <option value="logistics">Logistics</option>
              <option value="retail">Retail</option>
              <option value="real estate">Real estate</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-secondary block mb-1">City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Accra" />
          </div>
          <div>
            <label className="text-xs text-ink-secondary block mb-1">Limit</label>
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </div>
          <button
            type="button"
            disabled={pending || !city}
            className="w-full bg-brand text-white py-2 rounded-lg text-sm disabled:opacity-60"
            onClick={() =>
              startTransition(async () => {
                setResult(null);
                const r = await runScoutAction(sector, city, limit);
                setResult(r);
              })
            }
          >
            {pending ? "Scanning…" : "Start scan"}
          </button>
          {result ? <ResultBanner ok={result.ok} output={result.output} /> : null}
        </div>
      </Modal>
    </>
  );
}
