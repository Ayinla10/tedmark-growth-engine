import { query } from './db.js';
import { getCurrentAgencyId } from './agency.js';

// Every configurable value the agents use, with the defaults that were
// previously hardcoded. Anything missing from the settings table falls
// back to these, so the system works even before anyone visits Settings.
export const SETTINGS_DEFAULTS = {
  scout_sectors: ['restaurant', 'school', 'clinic', 'logistics', 'retail', 'real estate', 'event planning'],
  scout_cities: ['Accra', 'Kumasi', 'Tema', 'Takoradi', 'Cape Coast'],
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
};

export async function getSettings(agencyId) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query('SELECT key, value FROM settings WHERE agency_id = $1', [id]);
  const stored = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
  return { ...SETTINGS_DEFAULTS, ...stored };
}

export async function getSetting(key, agencyId) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query('SELECT value FROM settings WHERE agency_id = $1 AND key = $2', [id, key]);
  if (result.rows.length === 0) return SETTINGS_DEFAULTS[key];
  return result.rows[0].value;
}

export async function setSetting(key, value, agencyId) {
  const id = agencyId ?? (await getCurrentAgencyId());
  await query(
    `INSERT INTO settings (agency_id, key, value, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (agency_id, key) DO UPDATE SET value = $3, updated_at = now()`,
    [id, key, JSON.stringify(value)]
  );
}
