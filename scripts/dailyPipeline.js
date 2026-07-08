import { runScout } from '../agents/scout.js';
import { runEnricher } from '../agents/enricher.js';
import { runQualifier } from '../agents/qualifier.js';
import { runOutreach } from '../agents/outreach.js';
import { runSequencer } from '../agents/sequencer.js';

// Sectors this runs across each day. Kept modest per sector so a single run
// stays cheap (Geoapify + DeepSeek calls) even running unattended forever.
const SECTORS = ['restaurant', 'school', 'clinic', 'logistics', 'retail', 'real estate'];
const CITY = 'Accra';
const PER_SECTOR_LIMIT = 5;
const ENRICH_LIMIT = 50;
const QUALIFY_LIMIT = 50;
const OUTREACH_LIMIT = 20;

async function step(name, fn) {
  console.log(`\n=== ${name} ===`);
  try {
    await fn();
  } catch (err) {
    console.error(`[daily-pipeline] ${name} failed: ${err.message}`);
  }
}

export async function runDailyPipeline() {
  console.log(`[daily-pipeline] Starting run at ${new Date().toISOString()}`);

  for (const sector of SECTORS) {
    await step(`Scout: ${sector} in ${CITY}`, () =>
      runScout({ sector, city: CITY, limit: PER_SECTOR_LIMIT })
    );
  }

  await step('Enrich', () => runEnricher({ limit: ENRICH_LIMIT }));
  await step('Qualify', () => runQualifier({ limit: QUALIFY_LIMIT }));
  await step('Outreach drafts', () => runOutreach({ limit: OUTREACH_LIMIT }));
  await step('Sequencer', () => runSequencer());

  console.log(`\n[daily-pipeline] Run finished at ${new Date().toISOString()}`);
  console.log('[daily-pipeline] New outreach drafts are waiting for human review in the dashboard — nothing was auto-approved or sent.');
}
