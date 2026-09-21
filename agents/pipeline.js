/**
 * Pipeline Orchestrator
 *
 * Runs on a tick (default every 60 seconds) and advances each lead
 * through the pipeline automatically:
 *
 *   raw → [enrich] → enriched → [qualify] → qualified → [draft outreach]
 *
 * Rules:
 * - A lead with 3+ failed enrichment attempts and still no email is
 *   marked dead_end and removed from the pipeline.
 * - Qualification only runs when the lead has a valid email (or has_website).
 * - Outreach drafting only runs when score >= MIN_SCORE_FOR_OUTREACH and
 *   an email exists. The draft requires human approval before sending.
 * - Leads with pipeline_paused = true are skipped entirely.
 */

import { runEnricher }  from './enricher.js';
import { runQualifier } from './qualifier.js';
import { runOutreach as runOutreacher } from './outreach.js';
import { runSequencer } from './sequencer.js';
import {
  getPipelineLeads,
  recordEnrichmentAttempt,
  markLeadDeadEnd,
  getActiveAgencyIds,
  hasOutreachForLead,
  query,
} from '../tools/db.js';

const MAX_ENRICH_ATTEMPTS  = 3;
const MIN_SCORE_FOR_OUTREACH = 5;
const PIPELINE_INTERVAL_MS  = 60 * 1000; // 1 minute

let _running = false;

/**
 * Single pipeline tick for one agency.
 * Returns a summary of what was done.
 */
export async function runPipelineTick(agencyId) {
  const leads = await getPipelineLeads(agencyId, 50);
  if (leads.length === 0) return { agencyId, processed: 0 };

  const summary = {
    agencyId,
    total: leads.length,
    toEnrich: [],
    toQualify: [],
    toDraftOutreach: [],
    deadEnds: [],
  };

  for (const lead of leads) {
    const { status, email, score, enrichment_attempts: attempts } = lead;

    // ── Dead-end detection ───────────────────────────────────────────────
    if (status === 'raw' && !email && attempts >= MAX_ENRICH_ATTEMPTS) {
      summary.deadEnds.push(lead.id);
      await markLeadDeadEnd(lead.id, `No email found after ${attempts} enrichment attempts`);
      console.log(`[pipeline] Dead end: "${lead.business_name}" (${attempts} attempts, no email)`);
      continue;
    }

    // ── Needs enrichment ─────────────────────────────────────────────────
    if (status === 'raw') {
      summary.toEnrich.push(lead.id);
      continue;
    }

    // ── Needs qualification ──────────────────────────────────────────────
    if (status === 'enriched' && score == null) {
      summary.toQualify.push(lead.id);
      continue;
    }

    // ── Needs outreach draft ─────────────────────────────────────────────
    if (
      status === 'qualified' &&
      email &&
      score != null &&
      score >= MIN_SCORE_FOR_OUTREACH
    ) {
      const alreadyHasOutreach = await hasOutreachForLead(lead.id);
      if (!alreadyHasOutreach) {
        summary.toDraftOutreach.push(lead.id);
      }
      continue;
    }
  }

  // ── Run enrichment batch ─────────────────────────────────────────────────
  if (summary.toEnrich.length > 0) {
    console.log(`[pipeline] Enriching ${summary.toEnrich.length} leads for agency ${agencyId}...`);
    for (const leadId of summary.toEnrich) {
      await recordEnrichmentAttempt(leadId);
      await runEnricher({ leadId, agencyId }).catch(err =>
        console.error(`[pipeline] Enricher failed for ${leadId}:`, err.message)
      );
    }
  }

  // ── Run qualification batch ──────────────────────────────────────────────
  if (summary.toQualify.length > 0) {
    console.log(`[pipeline] Qualifying ${summary.toQualify.length} leads for agency ${agencyId}...`);
    for (const leadId of summary.toQualify) {
      await runQualifier({ leadId, agencyId }).catch(err =>
        console.error(`[pipeline] Qualifier failed for ${leadId}:`, err.message)
      );
    }
  }

  // ── Draft outreach batch ─────────────────────────────────────────────────
  if (summary.toDraftOutreach.length > 0) {
    console.log(`[pipeline] Drafting outreach for ${summary.toDraftOutreach.length} leads for agency ${agencyId}...`);
    for (const leadId of summary.toDraftOutreach) {
      await runOutreacher({ leadId, agencyId, limit: 1 }).catch(err =>
        console.error(`[pipeline] Outreacher failed for ${leadId}:`, err.message)
      );
    }
  }

  // ── Follow-up scheduling ─────────────────────────────────────────────────
  // The sequencer handles its own lead selection internally (contacted leads
  // with no pending follow-up that haven't replied after N days).
  // Run it once per tick so follow-ups are scheduled automatically.
  await runSequencer().catch(err =>
    console.error(`[pipeline] Sequencer failed for agency ${agencyId}:`, err.message)
  );

  summary.processed = summary.toEnrich.length + summary.toQualify.length + summary.toDraftOutreach.length + summary.deadEnds.length;
  console.log(`[pipeline] Tick complete for agency ${agencyId}: ${JSON.stringify({
    enrich: summary.toEnrich.length,
    qualify: summary.toQualify.length,
    outreach: summary.toDraftOutreach.length,
    deadEnds: summary.deadEnds.length,
  })}`);

  return summary;
}

/**
 * Run one tick across all active agencies (or a specific one).
 * @param {{ agencyId?: string }} [opts]
 */
export async function runPipeline(opts = {}) {
  if (_running) {
    console.log('[pipeline] Already running, skipping tick.');
    return;
  }
  _running = true;
  try {
    const agencyIds = opts.agencyId
      ? [opts.agencyId]
      : await getActiveAgencyIds();
    if (agencyIds.length === 0) {
      console.log('[pipeline] No active agencies.');
      return;
    }
    for (const agencyId of agencyIds) {
      await runPipelineTick(agencyId);
    }
  } catch (err) {
    console.error('[pipeline] Tick error:', err.message);
  } finally {
    _running = false;
  }
}

/**
 * Start the pipeline loop. Returns the interval handle.
 * Called once at server boot.
 */
export function startPipelineLoop(intervalMs = PIPELINE_INTERVAL_MS) {
  console.log(`[pipeline] Starting pipeline loop (every ${intervalMs / 1000}s)...`);
  // Run immediately on boot, then on interval
  runPipeline().catch(err => console.error('[pipeline] Boot tick error:', err.message));
  return setInterval(() => {
    runPipeline().catch(err => console.error('[pipeline] Interval tick error:', err.message));
  }, intervalMs);
}
