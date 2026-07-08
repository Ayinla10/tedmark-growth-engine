import { runScout } from '../agents/scout.js';
import { runEnricher } from '../agents/enricher.js';
import { runQualifier } from '../agents/qualifier.js';
import { runOutreach } from '../agents/outreach.js';
import { runSequencer } from '../agents/sequencer.js';
import { seedScoutProgress, getNextScoutBatch, recordScoutRun } from '../tools/db.js';

// The full target market. Expanded over time as more Ghanaian cities are
// added — each sector+city combination is tracked independently in
// scout_progress so daily runs page forward into fresh results instead of
// re-fetching the same top businesses forever.
const SECTORS = ['restaurant', 'school', 'clinic', 'logistics', 'retail', 'real estate'];
const CITIES = ['Accra', 'Kumasi', 'Tema', 'Takoradi', 'Cape Coast'];

// How many sector+city combinations to run per day. At ~30 total combos,
// this cycles through the whole matrix roughly every 3 days, each cycle
// paging further into results — tuned to land around 50-100 new leads/day.
const COMBOS_PER_DAY = 10;
const PER_COMBO_LIMIT = 8;

const ENRICH_LIMIT = 80;
const QUALIFY_LIMIT = 80;
const OUTREACH_LIMIT = 30;

async function step(name, fn) {
  console.log(`\n=== ${name} ===`);
  try {
    return await fn();
  } catch (err) {
    console.error(`[daily-pipeline] ${name} failed: ${err.message}`);
    return null;
  }
}

async function runScoutRotation() {
  for (const sector of SECTORS) {
    for (const city of CITIES) {
      await seedScoutProgress(sector, city);
    }
  }

  const batch = await getNextScoutBatch(COMBOS_PER_DAY);

  if (batch.length === 0) {
    console.log('[daily-pipeline] Every sector+city combination is exhausted — no more results available from Geoapify.');
    return;
  }

  for (const combo of batch) {
    const result = await step(`Scout: ${combo.sector} in ${combo.city} (offset ${combo.next_offset})`, () =>
      runScout({ sector: combo.sector, city: combo.city, limit: PER_COMBO_LIMIT, offset: combo.next_offset })
    );

    if (!result) continue;

    const exhausted = result.found < PER_COMBO_LIMIT;
    await recordScoutRun(combo.id, {
      nextOffset: combo.next_offset + result.found,
      exhausted,
    });

    if (exhausted) {
      console.log(`[daily-pipeline] "${combo.sector} in ${combo.city}" is now exhausted — Geoapify has nothing more for this combination.`);
    }
  }
}

export async function runDailyPipeline() {
  console.log(`[daily-pipeline] Starting run at ${new Date().toISOString()}`);

  await runScoutRotation();

  await step('Enrich', () => runEnricher({ limit: ENRICH_LIMIT }));
  await step('Qualify', () => runQualifier({ limit: QUALIFY_LIMIT }));
  await step('Outreach drafts', () => runOutreach({ limit: OUTREACH_LIMIT }));
  await step('Sequencer', () => runSequencer());

  console.log(`\n[daily-pipeline] Run finished at ${new Date().toISOString()}`);
  console.log('[daily-pipeline] New outreach drafts are waiting for human review in the dashboard — nothing was auto-approved or sent.');
}
