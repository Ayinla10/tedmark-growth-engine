"use client";

import { Play, Search, Pause } from "lucide-react";
import { useState, useTransition } from "react";
import { runScoutAction, setScoutEnabledAction } from "@/lib/actions";
import { Modal, ResultBanner } from "./modal";
import type { AgentRunResult } from "@/lib/runAgent";

export function RunScoutModal({ command = false, initialAutoEnabled = false }: { command?: boolean; initialAutoEnabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [sector, setSector] = useState("restaurant");
  const [city, setCity] = useState("Accra");
  const [limit, setLimit] = useState(20);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AgentRunResult | null>(null);

  const [autoEnabled, setAutoEnabled] = useState(initialAutoEnabled);
  const [togglePending, startToggle] = useTransition();

  function toggleAuto() {
    const next = !autoEnabled;
    startToggle(async () => {
      const r = await setScoutEnabledAction(next);
      if (r.ok) setAutoEnabled(next);
    });
  }

  if (!command) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-brand text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:shadow-lg transition-all"
        >
          <Search size={16} /> Find opportunities
        </button>
        <ScoutModal open={open} onClose={() => setOpen(false)} sector={sector} setSector={setSector} city={city} setCity={setCity} limit={limit} setLimit={setLimit} pending={pending} startTransition={startTransition} result={result} setResult={setResult} />
      </>
    );
  }

  // Command-center style: split button — left opens modal, right toggles daily auto
  return (
    <>
      <div className="flex items-stretch rounded-xl overflow-hidden border border-slate-600/50">
        {/* Left: manual run */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-[#0d1220] text-slate-100 px-5 py-2.5 flex items-center gap-2 text-sm font-semibold hover:bg-[#141b30] transition-all"
        >
          <Play size={15} />
          Find Businesses
        </button>
        {/* Divider */}
        <span className="w-px bg-slate-600/50" />
        {/* Right: daily auto toggle */}
        <button
          type="button"
          onClick={toggleAuto}
          disabled={togglePending}
          title={autoEnabled ? "Turn off daily auto-scout" : "Turn on daily auto-scout"}
          className={`px-3 py-2.5 flex items-center gap-1.5 text-xs font-medium transition-all disabled:opacity-60 ${
            autoEnabled
              ? "bg-[#0d1220] text-amber-400 hover:bg-red-950/40"
              : "bg-[#0d1220] text-slate-400 hover:bg-[#141b30]"
          }`}
        >
          {autoEnabled ? <Pause size={12} /> : <Play size={12} />}
          {togglePending ? "…" : autoEnabled ? "Auto: ON" : "Auto: OFF"}
        </button>
      </div>

      <ScoutModal open={open} onClose={() => setOpen(false)} sector={sector} setSector={setSector} city={city} setCity={setCity} limit={limit} setLimit={setLimit} pending={pending} startTransition={startTransition} result={result} setResult={setResult} />
    </>
  );
}

function ScoutModal({ open, onClose, sector, setSector, city, setCity, limit, setLimit, pending, startTransition, result, setResult }: {
  open: boolean; onClose: () => void;
  sector: string; setSector: (v: string) => void;
  city: string; setCity: (v: string) => void;
  limit: number; setLimit: (v: number) => void;
  pending: boolean; startTransition: (fn: () => Promise<void>) => void;
  result: AgentRunResult | null; setResult: (r: AgentRunResult | null) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Find businesses">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-ink-secondary block mb-1">Type of business</label>
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="restaurant">Restaurant</option>
            <option value="hotel">Hotel</option>
            <option value="school">School</option>
            <option value="clinic">Clinic</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="logistics">Logistics</option>
            <option value="retail">Retail shop</option>
            <option value="real estate">Real estate</option>
            <option value="law firm">Law firm</option>
            <option value="gym">Gym / fitness</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-secondary block mb-1">City</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Accra, Lagos, Nairobi…" />
        </div>
        <div>
          <label className="text-xs text-ink-secondary block mb-1">How many to find</label>
          <input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
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
  );
}
