/**
 * One-time setup: configure pipeline to discover 20+ qualified leads per day.
 * Run: node scripts/setupDailyTarget.js
 */
import { setSetting } from '../tools/settings.js';

const SECTORS = [
  // Original
  'restaurant', 'school', 'clinic', 'logistics', 'retail', 'real estate',
  // High-value additions for Ghana/West Africa
  'hotel', 'pharmacy', 'gym', 'law firm', 'beauty salon', 'auto repair',
  'church', 'construction', 'printing', 'travel agency', 'catering',
  'supermarket', 'accounting firm', 'daycare', 'event planning',
  'dental clinic', 'hospital', 'clothing store', 'electronics shop',
  'furniture store', 'hardware store',
];

const CITIES = [
  // Original
  'Accra', 'Kumasi', 'Tema', 'Takoradi', 'Cape Coast',
  // Additions
  'Tamale', 'Koforidua', 'Sunyani', 'Ho', 'Kasoa',
];

// 30 sectors × 10 cities = 300 combos — at 10/day that's 30 days before cycling
// Scout finds 8 leads per combo = up to 80 raw leads/day → 20+ reach outreach

async function main() {
  console.log('Updating pipeline settings for 20 leads/day target...');

  await setSetting('scout_sectors', SECTORS);
  await setSetting('scout_cities', CITIES);

  // Scout: 10 combos/day × 8 leads/combo = up to 80 raw leads
  await setSetting('scout_combos_per_day', 10);
  await setSetting('scout_per_combo_limit', 8);

  // Web scout: 5 more combos via Brave Search
  await setSetting('web_scout_combos_per_day', 5);
  await setSetting('web_scout_enabled', true);

  // Directory scout: 3 more combos via Ghanaian directories
  await setSetting('directory_scout_combos_per_day', 3);
  await setSetting('directory_scout_enabled', true);

  // Process limits — all > 80 so nothing gets left behind
  await setSetting('enrich_limit', 80);
  await setSetting('qualify_limit', 80);
  await setSetting('dm_enrich_limit', 50);
  await setSetting('icp_score_limit', 50);

  // Outreach: only the best 20 per day get a message drafted
  await setSetting('outreach_limit', 20);
  await setSetting('outreach_min_score', 6);

  console.log(`✓ Sectors: ${SECTORS.length} (${SECTORS.join(', ')})`);
  console.log(`✓ Cities: ${CITIES.length} (${CITIES.join(', ')})`);
  console.log(`✓ Combos available: ${SECTORS.length * CITIES.length} (~${Math.floor((SECTORS.length * CITIES.length) / 10)} days before cycling)`);
  console.log('✓ Scout: 10 combos/day × 8 leads = up to 80 raw leads/day');
  console.log('✓ Outreach: top 20 scoring leads get a message drafted daily');
  console.log('\nDone. The 7am pipeline will now target 20 qualified outreach drafts per day.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
