import { runScout } from '../agents/scout.js';
import { runWebScout } from '../agents/webScout.js';
import { runDirectoryScout } from '../agents/directoryScout.js';
import { runEnricher } from '../agents/enricher.js';
import { runDmEnrich } from '../agents/dmEnrich.js';
import { runQualifier } from '../agents/qualifier.js';
import { runIcpScorer } from '../agents/icpScorer.js';
import { runOutreach } from '../agents/outreach.js';
import { runSequencer } from '../agents/sequencer.js';
import { runAnalytics } from '../agents/analytics.js';
import {
  seedScoutProgress,
  getNextScoutBatch,
  recordScoutRun,
  seedSearchProgress,
  getNextSearchBatch,
  recordSearchRun,
  seedDirectoryProgress,
  getNextDirectoryBatch,
  recordDirectoryRun,
} from '../tools/db.js';
import { buildQueries } from '../tools/searchQueries.js';
import { resolveSectorSlugs } from '../tools/directoryParsing.js';
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
  if (!settings.scout_enabled) {
    console.log('[daily-pipeline] Maps-based Scout discovery is disabled in settings — skipping.');
    return;
  }

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

    // A failed API call is not the same thing as "no more results" — leave
    // this combo's progress untouched so it retries at the same offset next
    // run, instead of silently marking it exhausted and never trying again.
    if (result.error) {
      console.warn(`[daily-pipeline] "${combo.sector} in ${combo.city}" failed (${result.error}) — will retry at the same offset next run, not marking exhausted.`);
      continue;
    }

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

async function runWebScoutRotation(settings) {
  if (!settings.web_scout_enabled) {
    console.log('[daily-pipeline] Web-scout discovery is disabled in settings — skipping.');
    return;
  }

  const { scout_sectors: sectors, scout_cities: cities, web_scout_combos_per_day: combosPerDay } = settings;

  for (const sector of sectors) {
    for (const city of cities) {
      for (const { type } of buildQueries(sector, city)) {
        await seedSearchProgress(sector, city, type);
      }
    }
  }

  const batch = await getNextSearchBatch(combosPerDay);

  if (batch.length === 0) {
    console.log('[daily-pipeline] Every search discovery combination is exhausted for now.');
    return;
  }

  for (const combo of batch) {
    const queries = buildQueries(combo.sector, combo.city);
    const match = queries.find((q) => q.type === combo.query_type);
    if (!match) continue;

    const result = await step(`Web-scout: ${combo.query_type} — ${combo.sector} in ${combo.city} (offset ${combo.next_offset})`, () =>
      runWebScout({ sector: combo.sector, city: combo.city, query: match.query, queryType: combo.query_type, offset: combo.next_offset })
    );

    if (!result) continue;

    if (result.error) {
      console.warn(`[daily-pipeline] "${combo.query_type}: ${combo.sector} in ${combo.city}" failed (${result.error}) — will retry at the same offset next run, not marking exhausted.`);
      continue;
    }

    const exhausted = result.found === 0;
    await recordSearchRun(combo.id, {
      nextOffset: combo.next_offset + 1,
      exhausted,
    });

    if (exhausted) {
      console.log(`[daily-pipeline] "${combo.query_type}: ${combo.sector} in ${combo.city}" is now exhausted — no more results from the Search API.`);
    }
  }
}

async function runDirectoryScoutRotation(settings) {
  if (!settings.directory_scout_enabled) {
    console.log('[daily-pipeline] Directory discovery is disabled in settings — skipping.');
    return;
  }

  const { scout_sectors: sectors, directory_scout_combos_per_day: combosPerDay } = settings;

  for (const sector of sectors) {
    for (const slug of resolveSectorSlugs(sector)) {
      await seedDirectoryProgress(slug, sector);
    }
  }

  const batch = await getNextDirectoryBatch(combosPerDay);

  if (batch.length === 0) {
    console.log('[daily-pipeline] Every directory category is exhausted for now, or no sector maps to a directory category.');
    return;
  }

  for (const combo of batch) {
    const result = await step(`Directory-scout: ${combo.category_slug} (${combo.sector}, page ${combo.next_page})`, () =>
      runDirectoryScout({ sector: combo.sector, categorySlug: combo.category_slug, page: combo.next_page })
    );

    if (!result) continue;

    if (result.error) {
      console.warn(`[daily-pipeline] Directory category "${combo.category_slug}" failed (${result.error}) — will retry the same page next run, not marking exhausted.`);
      continue;
    }

    const exhausted = result.found === 0;
    await recordDirectoryRun(combo.id, {
      nextPage: combo.next_page + 1,
      exhausted,
    });

    if (exhausted) {
      console.log(`[daily-pipeline] Directory category "${combo.category_slug}" is now exhausted — no more listings.`);
    }
  }
}

export async function runDailyPipeline() {
  console.log(`[daily-pipeline] Starting run at ${new Date().toISOString()}`);

  const settings = await getSettings();
  console.log(`[daily-pipeline] Using settings: ${JSON.stringify(settings)}`);

  await runScoutRotation(settings);
  await runWebScoutRotation(settings);
  await runDirectoryScoutRotation(settings);

  await step('Enrich', () => runEnricher({ limit: settings.enrich_limit }));
  await step('Qualify', () => runQualifier({ limit: settings.qualify_limit }));
  await step('DM enrich', () => runDmEnrich({ limit: settings.dm_enrich_limit }));
  await step('ICP score', () => runIcpScorer({ limit: settings.icp_score_limit }));
  await step('Outreach drafts', () => runOutreach({ limit: settings.outreach_limit }));
  await step('Sequencer', () => runSequencer());
  await step('Analytics', () => runAnalytics());

  console.log(`\n[daily-pipeline] Run finished at ${new Date().toISOString()}`);
  console.log('[daily-pipeline] New outreach drafts are waiting for human review in the dashboard — nothing was auto-approved or sent.');
}
