import pool from "./db";

export const SETTINGS_DEFAULTS = {
  scout_sectors: ["restaurant", "school", "clinic", "logistics", "retail", "real estate"],
  scout_cities: ["Accra", "Kumasi", "Tema", "Takoradi", "Cape Coast"],
  scout_combos_per_day: 10,
  scout_per_combo_limit: 8,
  enrich_limit: 80,
  qualify_limit: 80,
  outreach_limit: 30,
  outreach_min_score: 6,
  sequencer_days_between_steps: 3,
  sequencer_max_steps: 3,
} as const;

export type Settings = {
  scout_sectors: string[];
  scout_cities: string[];
  scout_combos_per_day: number;
  scout_per_combo_limit: number;
  enrich_limit: number;
  qualify_limit: number;
  outreach_limit: number;
  outreach_min_score: number;
  sequencer_days_between_steps: number;
  sequencer_max_steps: number;
};

export async function getSettings(): Promise<Settings> {
  const result = await pool.query("SELECT key, value FROM settings");
  const stored = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
  return { ...SETTINGS_DEFAULTS, ...stored } as Settings;
}

export async function setSetting(key: keyof Settings, value: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}
