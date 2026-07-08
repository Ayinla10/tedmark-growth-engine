import { runScout } from '../agents/scout.js';
import { runEnricher } from '../agents/enricher.js';
import { runQualifier } from '../agents/qualifier.js';
import { runOutreach } from '../agents/outreach.js';
import { runSequencer } from '../agents/sequencer.js';
import { seedScoutProgress, getNextScoutBatch, recordScoutRun } from '../tools/db.js';
import { getSettings } from '../tools/settings.js';

async function step(name, fn) {
  console.log(`\n=== ${name} ===`);
  try {
    return await fn();
  } catch (err) {
    console.error(`[daily-pipeline] ${name} failed: ${err.message}`);
    return null;
  }
}

async function runScoutRotation(settings) {
  const { scout_sectors: sectors, scout_cities: cities, scout_combos_per_day: combosPerDay, scout_per_combo_limit: perComboLimit } = settings;

  for (const sector of sectors) {
    for (const city of cities) {
      await seedScoutProgress(sector, city);
    }
  }

  const batch = await getNextScoutBatch(combosPerDay);

  if (batch.length === 0) {
    console.log('[daily-pipeline] Every sector+city combination is exhausted — no more results available from Geoapify.');
    return;
  }

  for (const combo of batch) {
    const result = await step(`Scout: ${combo.sector} in ${combo.city} (offset ${combo.next_offset})`, () =>
      runScout({ sector: combo.sector, city: combo.city, limit: perComboLimit, offset: combo.next_offset })
    );

    if (!result) continue;

    const exhausted = result.found < perComboLimit;
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

  const settings = await getSettings();
  console.log(`[daily-pipeline] Using settings: ${JSON.stringify(settings)}`);

  await runScoutRotation(settings);

  await step('Enrich', () => runEnricher({ limit: settings.enrich_limit }));
  await step('Qualify', () => runQualifier({ limit: settings.qualify_limit }));
  await step('Outreach drafts', () => runOutreach({ limit: settings.outreach_limit }));
  await step('Sequencer', () => runSequencer());

  console.log(`\n[daily-pipeline] Run finished at ${new Date().toISOString()}`);
  console.log('[daily-pipeline] New outreach drafts are waiting for human review in the dashboard — nothing was auto-approved or sent.');
}
