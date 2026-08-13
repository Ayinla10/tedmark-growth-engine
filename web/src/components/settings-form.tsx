"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/lib/actions";
import type { Settings } from "@/lib/settings";
import { ResultBanner } from "./modal";
import { CountryPicker } from "./country-picker";

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
  const [countries, setCountries] = useState<string[]>(initial.scout_countries ?? ["Ghana"]);
  const [sectors, setSectors] = useState(initial.scout_sectors.join(", "));
  const [scoutEnabled, setScoutEnabled] = useState(initial.scout_enabled);
  const [combosPerDay, setCombosPerDay] = useState(initial.scout_combos_per_day);
  const [perComboLimit, setPerComboLimit] = useState(initial.scout_per_combo_limit);
  const [webScoutEnabled, setWebScoutEnabled] = useState(initial.web_scout_enabled);
  const [webScoutCombosPerDay, setWebScoutCombosPerDay] = useState(initial.web_scout_combos_per_day);
  const [directoryScoutEnabled, setDirectoryScoutEnabled] = useState(initial.directory_scout_enabled);
  const [directoryScoutCombosPerDay, setDirectoryScoutCombosPerDay] = useState(initial.directory_scout_combos_per_day);
  const [enrichLimit, setEnrichLimit] = useState(initial.enrich_limit);
  const [qualifyLimit, setQualifyLimit] = useState(initial.qualify_limit);
  const [dmEnrichLimit, setDmEnrichLimit] = useState(initial.dm_enrich_limit);
  const [icpScoreLimit, setIcpScoreLimit] = useState(initial.icp_score_limit);
  const [outreachLimit, setOutreachLimit] = useState(initial.outreach_limit);
  const [minScore, setMinScore] = useState(initial.outreach_min_score);
  const [daysBetweenSteps, setDaysBetweenSteps] = useState(initial.sequencer_days_between_steps);
  const [maxSteps, setMaxSteps] = useState(initial.sequencer_max_steps);
  const [idleLogoutMinutes, setIdleLogoutMinutes] = useState(initial.idle_logout_minutes);
  const [deepseekInputRate, setDeepseekInputRate] = useState(initial.cost_rate_deepseek_input_per_1m);
  const [deepseekOutputRate, setDeepseekOutputRate] = useState(initial.cost_rate_deepseek_output_per_1m);
  const [geoapifyRate, setGeoapifyRate] = useState(initial.cost_rate_geoapify_per_request);
  const [braveRate, setBraveRate] = useState(initial.cost_rate_brave_per_request);
  const [resendRate, setResendRate] = useState(initial.cost_rate_resend_per_email);

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; output?: string } | null>(null);

  function save() {
    startTransition(async () => {
      const settings: Settings = {
        scout_countries: countries,
        scout_sectors: sectors.split(",").map((s) => s.trim()).filter(Boolean),
        // Cities are derived from countries server-side — still pass current value so nothing breaks
        scout_cities: initial.scout_cities,
        scout_enabled: scoutEnabled,
        scout_combos_per_day: combosPerDay,
        scout_per_combo_limit: perComboLimit,
        web_scout_enabled: webScoutEnabled,
        web_scout_combos_per_day: webScoutCombosPerDay,
        directory_scout_enabled: directoryScoutEnabled,
        directory_scout_combos_per_day: directoryScoutCombosPerDay,
        enrich_limit: enrichLimit,
        qualify_limit: qualifyLimit,
        dm_enrich_limit: dmEnrichLimit,
        icp_score_limit: icpScoreLimit,
        outreach_limit: outreachLimit,
        outreach_min_score: minScore,
        sequencer_days_between_steps: daysBetweenSteps,
        sequencer_max_steps: maxSteps,
        idle_logout_minutes: idleLogoutMinutes,
        cost_rate_deepseek_input_per_1m: deepseekInputRate,
        cost_rate_deepseek_output_per_1m: deepseekOutputRate,
        cost_rate_geoapify_per_request: geoapifyRate,
        cost_rate_brave_per_request: braveRate,
        cost_rate_resend_per_email: resendRate,
      };
      const r = await saveSettingsAction(settings);
      setResult(r);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-ink mb-3">Where Scout looks</p>
        <div className="space-y-4">
          <CountryPicker selected={countries} onChange={setCountries} />
          <div>
            <label className="text-xs text-ink-secondary block mb-1">Target sectors (comma-separated)</label>
            <input type="text" value={sectors} onChange={(e) => setSectors(e.target.value)} className="w-full" />
            <p className="text-xs text-ink-muted mt-1">e.g. restaurant, school, clinic, hotel, pharmacy, gym</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-3">How much Scout does per day</p>
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={scoutEnabled} onChange={(e) => setScoutEnabled(e.target.checked)} />
            Run Maps-based Scout discovery in the daily pipeline
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumberField
            label="Sector+city combinations per day"
            value={combosPerDay}
            onChange={setCombosPerDay}
            hint="How many of the sector × city pairs get scouted each run. Higher = faster coverage, more API usage."
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
          Finds businesses via Google search dorks and LinkedIn/Facebook search snippets, alongside the Maps-based Scout above.
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
            hint="How many sector × city × query-type combinations to search each day."
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-3">Directory discovery (free)</p>
        <p className="text-xs text-ink-muted mb-3">
          Finds businesses via BusinessGhana.com&apos;s public directory — no API key, no quota.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-ink-secondary block mb-1">Enabled</label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={directoryScoutEnabled} onChange={(e) => setDirectoryScoutEnabled(e.target.checked)} />
              Run directory discovery in the daily pipeline
            </label>
          </div>
          <NumberField
            label="Directory categories per day"
            value={directoryScoutCombosPerDay}
            onChange={setDirectoryScoutCombosPerDay}
            hint="How many directory categories to page through each day."
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-3">Batch sizes for the other agents</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberField label="Enrich — leads per run" value={enrichLimit} onChange={setEnrichLimit} />
          <NumberField label="Qualify — leads per run" value={qualifyLimit} onChange={setQualifyLimit} />
          <NumberField label="Find decision-maker — leads per run" value={dmEnrichLimit} onChange={setDmEnrichLimit} />
          <NumberField label="ICP score — leads per run" value={icpScoreLimit} onChange={setIcpScoreLimit} />
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
        <p className="text-sm font-semibold text-ink mb-3">Session security</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberField
            label="Auto-logout after idle (minutes)"
            value={idleLogoutMinutes}
            onChange={setIdleLogoutMinutes}
            min={1}
            hint="Signs everyone out automatically after this many minutes with no activity."
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-3">Cost rates (for the API spend dashboard)</p>
        <p className="text-xs text-ink-muted mb-3">
          Enter your real per-unit rate from each provider&apos;s billing page. Left at 0, that provider&apos;s cost
          shows as &quot;not configured&quot; — usage counts are always tracked regardless.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberField label="DeepSeek input — $ per 1M tokens" value={deepseekInputRate} onChange={setDeepseekInputRate} min={0} />
          <NumberField label="DeepSeek output — $ per 1M tokens" value={deepseekOutputRate} onChange={setDeepseekOutputRate} min={0} />
          <NumberField label="Geoapify — $ per request" value={geoapifyRate} onChange={setGeoapifyRate} min={0} />
          <NumberField label="Brave Search — $ per request" value={braveRate} onChange={setBraveRate} min={0} />
          <NumberField label="Resend — $ per email" value={resendRate} onChange={setResendRate} min={0} />
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
