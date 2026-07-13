"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/lib/actions";
import type { Settings } from "@/lib/settings";
import { ResultBanner } from "./modal";

function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs text-ink-secondary block mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      {hint ? <p className="text-xs text-ink-muted mt-1">{hint}</p> : null}
    </div>
  );
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const [sectors, setSectors] = useState(initial.scout_sectors.join(", "));
  const [cities, setCities] = useState(initial.scout_cities.join(", "));
  const [combosPerDay, setCombosPerDay] = useState(initial.scout_combos_per_day);
  const [perComboLimit, setPerComboLimit] = useState(initial.scout_per_combo_limit);
  const [webScoutEnabled, setWebScoutEnabled] = useState(initial.web_scout_enabled);
  const [webScoutCombosPerDay, setWebScoutCombosPerDay] = useState(initial.web_scout_combos_per_day);
  const [enrichLimit, setEnrichLimit] = useState(initial.enrich_limit);
  const [qualifyLimit, setQualifyLimit] = useState(initial.qualify_limit);
  const [outreachLimit, setOutreachLimit] = useState(initial.outreach_limit);
  const [minScore, setMinScore] = useState(initial.outreach_min_score);
  const [daysBetweenSteps, setDaysBetweenSteps] = useState(initial.sequencer_days_between_steps);
  const [maxSteps, setMaxSteps] = useState(initial.sequencer_max_steps);

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; output?: string } | null>(null);

  function save() {
    startTransition(async () => {
      const settings: Settings = {
        scout_sectors: sectors.split(",").map((s) => s.trim()).filter(Boolean),
        scout_cities: cities.split(",").map((s) => s.trim()).filter(Boolean),
        scout_combos_per_day: combosPerDay,
        scout_per_combo_limit: perComboLimit,
        web_scout_enabled: webScoutEnabled,
        web_scout_combos_per_day: webScoutCombosPerDay,
        enrich_limit: enrichLimit,
        qualify_limit: qualifyLimit,
        outreach_limit: outreachLimit,
        outreach_min_score: minScore,
        sequencer_days_between_steps: daysBetweenSteps,
        sequencer_max_steps: maxSteps,
      };
      const r = await saveSettingsAction(settings);
      setResult(r);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-ink mb-3">Where Scout looks</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-ink-secondary block mb-1">Target sectors (comma-separated)</label>
            <input type="text" value={sectors} onChange={(e) => setSectors(e.target.value)} className="w-full" />
            <p className="text-xs text-ink-muted mt-1">e.g. restaurant, school, clinic, logistics, retail, real estate</p>
          </div>
          <div>
            <label className="text-xs text-ink-secondary block mb-1">Target cities (comma-separated)</label>
            <input type="text" value={cities} onChange={(e) => setCities(e.target.value)} className="w-full" />
            <p className="text-xs text-ink-muted mt-1">e.g. Accra, Kumasi, Tema, Takoradi, Cape Coast</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-3">How much Scout does per day</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumberField
            label="Sector+city combinations per day"
            value={combosPerDay}
            onChange={setCombosPerDay}
            hint="How many of the sector x city pairs above get scouted each run. Higher = faster coverage, more API usage."
          />
          <NumberField
            label="Businesses fetched per combination"
            value={perComboLimit}
            onChange={setPerComboLimit}
            max={500}
            hint="Geoapify allows up to 500 per request."
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-3">Web search discovery</p>
        <p className="text-xs text-ink-muted mb-3">
          Finds businesses via Google search dorks and LinkedIn/Facebook search snippets, alongside the Maps-based Scout above. Needs a
          Google Programmable Search API key configured on the server.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-ink-secondary block mb-1">Enabled</label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={webScoutEnabled} onChange={(e) => setWebScoutEnabled(e.target.checked)} />
              Run web search discovery in the daily pipeline
            </label>
          </div>
          <NumberField
            label="Search combinations per day"
            value={webScoutCombosPerDay}
            onChange={setWebScoutCombosPerDay}
            hint="How many sector x city x query-type combinations to search each day."
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-3">Batch sizes for the other agents</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberField label="Enrich — leads per run" value={enrichLimit} onChange={setEnrichLimit} />
          <NumberField label="Qualify — leads per run" value={qualifyLimit} onChange={setQualifyLimit} />
          <NumberField label="Outreach — drafts per run" value={outreachLimit} onChange={setOutreachLimit} />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-3">Outreach and follow-up rules</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberField
            label="Minimum score to draft outreach"
            value={minScore}
            onChange={setMinScore}
            min={1}
            max={10}
            hint="Leads scoring below this never get a draft written."
          />
          <NumberField
            label="Days silent before a follow-up"
            value={daysBetweenSteps}
            onChange={setDaysBetweenSteps}
            hint="How long to wait after a sent message with no reply."
          />
          <NumberField
            label="Max follow-up attempts"
            value={maxSteps}
            onChange={setMaxSteps}
            hint="After this many silent follow-ups, the lead is archived automatically."
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {result ? <ResultBanner ok={result.ok} output={result.output ?? ""} /> : null}
      </div>
    </div>
  );
}
