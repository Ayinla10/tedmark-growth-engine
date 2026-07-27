import pool from "./db";
import { getCurrentAgencyId } from "./agency";

export const SETTINGS_DEFAULTS = {
  scout_sectors: ["restaurant", "school", "clinic", "logistics", "retail", "real estate", "event planning"],
  scout_cities: ["Accra", "Kumasi", "Tema", "Takoradi", "Cape Coast"],
  scout_enabled: true,
  scout_combos_per_day: 10,
  scout_per_combo_limit: 8,
  web_scout_enabled: true,
  web_scout_combos_per_day: 5,
  directory_scout_enabled: true,
  directory_scout_combos_per_day: 3,
  enrich_limit: 80,
  qualify_limit: 80,
  outreach_limit: 30,
  outreach_min_score: 6,
  sequencer_days_between_steps: 3,
  sequencer_max_steps: 3,
  idle_logout_minutes: 15,
} as const;

export type Settings = {
  scout_sectors: string[];
  scout_cities: string[];
  scout_enabled: boolean;
  scout_combos_per_day: number;
  scout_per_combo_limit: number;
  web_scout_enabled: boolean;
  web_scout_combos_per_day: number;
  directory_scout_enabled: boolean;
  directory_scout_combos_per_day: number;
  enrich_limit: number;
  qualify_limit: number;
  outreach_limit: number;
  outreach_min_score: number;
  sequencer_days_between_steps: number;
  sequencer_max_steps: number;
  idle_logout_minutes: number;
};

export async function getSettings(): Promise<Settings> {
  const agencyId = await getCurrentAgencyId();
  const result = await pool.query("SELECT key, value FROM settings WHERE agency_id = $1", [agencyId]);
  const stored = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
  return { ...SETTINGS_DEFAULTS, ...stored } as Settings;
}

export async function setSetting(key: keyof Settings, value: unknown): Promise<void> {
  const agencyId = await getCurrentAgencyId();
  await pool.query(
    `INSERT INTO settings (agency_id, key, value, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (agency_id, key) DO UPDATE SET value = $3, updated_at = now()`,
    [agencyId, key, JSON.stringify(value)]
  );
}
