import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { query } from './tools/db.js';

// ── Agent imports ──────────────────────────────────────────────────────────────
import { runScout }           from './agents/scout.js';
import { runWebScout }        from './agents/webScout.js';
import { runDirectoryScout }  from './agents/directoryScout.js';
import { runEnricher }        from './agents/enricher.js';
import { runDmEnrich }        from './agents/dmEnrich.js';
import { runQualifier }       from './agents/qualifier.js';
import { runIcpScorer }       from './agents/icpScorer.js';
import { runOutreach, runSend } from './agents/outreach.js';
import { runSequencer }       from './agents/sequencer.js';
import { runProposal }        from './agents/proposal.js';
import { runSendProposal }    from './agents/proposalDelivery.js';
import { runAnalytics }       from './agents/analytics.js';
import { runCleanKnowledge }  from './agents/knowledgeCleaner.js';
import { runDailyPipeline }   from './scripts/dailyPipeline.js';
import { runReplyWatcher }    from './agents/replyWatcher.js';

// ── WhatsApp handler ───────────────────────────────────────────────────────────
import { handleIncomingWhatsApp } from './agents/whatsappAgent.js';

// Build a human-readable, toast-friendly output string from enricher results.
function buildEnrichOutput(results) {
  if (!results || results.length === 0) {
    return 'ENRICH_RESULT\nstatus: nothing_to_do\nreason: No leads needed enrichment — they may already have full contact details.';
  }

  const TIER_LABEL = {
    official_site: 'business website',
    directory_aggregator: 'directory listing (MX verified)',
    general_web_page: 'web search (MX verified)',
  };
  const SOURCE_LABEL = { geoapify: 'Geoapify', google_maps: 'Google Maps', website: 'website' };

  const lines = ['ENRICH_RESULT'];

  for (const r of results) {
    lines.push(`business: ${r.business_name}`);

    // Email
    if (r.emailAction === 'found') {
      lines.push(`email_action: found`);
      lines.push(`email: ${r.email}`);
      lines.push(`email_source: ${TIER_LABEL[r.emailTier] ?? r.emailTier}`);
    } else if (r.emailAction === 'replaced') {
      lines.push(`email_action: replaced`);
      lines.push(`email: ${r.email}`);
      lines.push(`email_prev: ${r.emailPrev}`);
      lines.push(`email_source: ${TIER_LABEL[r.emailTier] ?? r.emailTier}`);
      lines.push(`email_replace_reason: previous email failed MX check (domain does not accept mail)`);
    } else if (r.emailAction === 'cleared') {
      lines.push(`email_action: cleared`);
      lines.push(`email_prev: ${r.emailPrev}`);
      lines.push(`email_clear_reason: failed MX check and no verified replacement found`);
    } else if (r.emailRejections?.length > 0) {
      lines.push(`email_action: none_saved`);
      // Report the top rejection reason
      const top = r.emailRejections[0];
      lines.push(`email_rejected: ${top.email}`);
      lines.push(`email_reject_reason: ${top.reason}`);
    } else {
      lines.push(`email_action: not_found`);
    }

    // Phone
    if (r.phone) {
      lines.push(`phone: ${r.phone}`);
      if (r.phoneSource) lines.push(`phone_source: ${SOURCE_LABEL[r.phoneSource] ?? r.phoneSource}`);
    }

    // Website
    if (r.website) {
      lines.push(`website: ${r.website}`);
      if (r.websiteSource) lines.push(`website_source: ${SOURCE_LABEL[r.websiteSource] ?? r.websiteSource}`);
    }
  }

  return lines.join('\n');
}

// ── Telegram bot ───────────────────────────────────────────────────────────────
import { runTelegramBot } from './agents/telegramBot.js';

const app  = express();
const PORT = process.env.PORT || 4000;

const VERIFY_TOKEN  = process.env.WHATSAPP_VERIFY_TOKEN;
const API_SECRET    = process.env.RENDER_API_SECRET; // shared secret Vercel uses to call us

app.use(express.json());

// ── Auth middleware for agent API ──────────────────────────────────────────────
function requireSecret(req, res, next) {
  const auth = req.headers['authorization'];
  if (!API_SECRET || auth !== `Bearer ${API_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, service: 'tedmark-agent-server' }));

// ── WhatsApp webhook — GET verification ───────────────────────────────────────
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[whatsapp] ✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  console.warn('[whatsapp] ❌ Verification failed — token mismatch');
  return res.sendStatus(403);
});

// ── WhatsApp webhook — POST incoming messages ──────────────────────────────────
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return res.sendStatus(404);

  // Must respond 200 within 5s — process async
  res.sendStatus(200);

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        for (const msg of value.messages ?? []) {
          const from = msg.from;
          const type = msg.type;
          const text = type === 'text' ? msg.text?.body : null;
          console.log(`[whatsapp] 📩 ${from}: ${text ?? `[${type}]`}`);
          await handleIncomingWhatsApp({ from, text, type, msgId: msg.id });
        }
        for (const status of value.statuses ?? []) {
          console.log(`[whatsapp] 📋 ${status.status} → ${status.recipient_id}`);
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp] Error:', err);
  }
});

// ── Agent HTTP API (called by Vercel instead of child_process) ─────────────────
// POST /run/:command  { args: { key: value } }
app.post('/run/:command', requireSecret, async (req, res) => {
  const { command } = req.params;
  const args = req.body?.args ?? {};

  console.log(`[agent-api] ▶ ${command}`, args);

  let output = '';
  let ok = true;

  try {
    const since = new Date().toISOString(); // capture before run to query what changed

    switch (command) {
      case 'scout': {
        const scoutStats = await runScout({ sector: args.sector, city: args.city, limit: parseInt(args.limit) || 20, country: args.country || 'GH' });
        const r = await query(
          `SELECT id, business_name, location, sector, phone, website_url FROM leads WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 30`,
          [since]
        );
        const found = r.rows;
        res._scoutLeadIds = found.map(l => l.id);
        if (found.length) {
          output = `Found ${found.length} leads:\n` + found.map(l => `- ${l.business_name} (${l.location ?? args.city}) | ${l.phone ?? 'no phone'} | ${l.website_url ?? 'no website'}`).join('\n');
        } else {
          const why = scoutStats.skipped > 0
            ? `Google returned ${scoutStats.found} results but all ${scoutStats.skipped} were already in the database.`
            : `Google returned no results for "${args.sector}" businesses in ${args.city}.`;
          output = `No new leads saved. ${why} Searched: sector="${args.sector}", city="${args.city}".`;
        }
        break;
      }
      case 'web-scout': {
        const webStats = await runWebScout({ sector: args.sector, city: args.city, limit: parseInt(args.limit) || 20 });
        const r = await query(
          `SELECT id, business_name, location, sector, phone, website_url FROM leads WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 30`,
          [since]
        );
        const found = r.rows;
        res._scoutLeadIds = found.map(l => l.id);
        if (found.length) {
          output = `Found ${found.length} leads:\n` + found.map(l => `- ${l.business_name} (${l.location ?? args.city}) | ${l.phone ?? 'no phone'} | ${l.website_url ?? 'no website'}`).join('\n');
        } else {
          const why = webStats?.skipped > 0
            ? `Found ${webStats.found} candidates online but all ${webStats.skipped} were already in the database.`
            : `No candidates found online for "${args.sector}" in ${args.city}.`;
          output = `No new leads saved. ${why} Searched: sector="${args.sector}", city="${args.city}".`;
        }
        break;
      }
      case 'enrich': {
        const filterArgs = { sector: args.sector, city: args.city, since: args.since, lead_ids: args.lead_ids };
        const enrichResults = await runEnricher({ limit: parseInt(args.limit) || 20, leadId: args['lead-id'], agencyId: args.agency_id, ...filterArgs }) ?? [];
        output = buildEnrichOutput(enrichResults);
        break;
      }
      case 'enrich-dm': {
        const filterArgs = { sector: args.sector, city: args.city, since: args.since, lead_ids: args.lead_ids };
        await runDmEnrich({ limit: parseInt(args.limit) || 20, leadId: args['lead-id'], agencyId: args.agency_id, ...filterArgs });
        const r = await query(
          `SELECT business_name, dm_name, dm_title, dm_linkedin_url FROM leads WHERE dm_enriched_at >= $1 AND dm_name IS NOT NULL ORDER BY dm_enriched_at DESC LIMIT 20`,
          [since]
        );
        output = r.rows.length
          ? `Found decision makers for ${r.rows.length} leads:\n` + r.rows.map(l => `- ${l.business_name}: ${l.dm_name ?? '—'} (${l.dm_title ?? 'unknown role'})`).join('\n')
          : 'DM enrichment ran — no new decision makers found.';
        break;
      }
      case 'icp-score': {
        const filterArgs = { sector: args.sector, city: args.city, since: args.since, lead_ids: args.lead_ids };
        await runIcpScorer({ limit: parseInt(args.limit) || 20, leadId: args['lead-id'], agencyId: args.agency_id, ...filterArgs });
        const r = await query(
          `SELECT business_name, icp_total, icp_reasoning FROM leads WHERE icp_scored_at >= $1 AND icp_total IS NOT NULL ORDER BY icp_total DESC LIMIT 20`,
          [since]
        );
        output = r.rows.length
          ? `ICP scored ${r.rows.length} leads:\n` + r.rows.map(l => `- ${l.business_name}: ${l.icp_total}/25 — ${l.icp_reasoning ?? ''}`).join('\n')
          : 'ICP scorer ran — no leads scored in this run.';
        break;
      }
      case 'qualify': {
        const filterArgs = { sector: args.sector, city: args.city, since: args.since, lead_ids: args.lead_ids };
        await runQualifier({ limit: parseInt(args.limit) || 20, leadId: args['lead-id'], agencyId: args.agency_id, ...filterArgs });
        const r = await query(
          `SELECT business_name, score, score_reason FROM leads WHERE qualified_at >= $1 AND score IS NOT NULL ORDER BY score DESC LIMIT 20`,
          [since]
        );
        output = r.rows.length
          ? `Qualified ${r.rows.length} leads:\n` + r.rows.map(l => `- ${l.business_name}: ${l.score}/10 — ${l.score_reason ?? ''}`).join('\n')
          : 'Qualifier ran — no leads were scored in this run.';
        break;
      }
      case 'outreach': {
        const filterArgs = { sector: args.sector, city: args.city, since: args.since, lead_ids: args.lead_ids };
        await runOutreach({ limit: parseInt(args.limit) || 10, leadId: args['lead-id'], signatureId: args['signature-id'], agencyId: args.agency_id, score_min: args.score_min, ...filterArgs });
        const r = await query(
          `SELECT o.subject, l.business_name FROM outreach o JOIN leads l ON l.id = o.lead_id WHERE o.created_at >= $1 AND o.status = 'draft' ORDER BY o.created_at DESC LIMIT 20`,
          [since]
        );
        output = r.rows.length
          ? `Generated ${r.rows.length} outreach drafts:\n` + r.rows.map(o => `- ${o.business_name}: "${o.subject}"`).join('\n')
          : 'Outreach ran — no new drafts created (qualified leads may have drafts already).';
        break;
      }
      case 'send':
        await runSend({ outreachId: args['outreach-id'], to: args.to });
        output = 'Email sent.';
        break;
      case 'send-proposal':
        await runSendProposal({ proposalId: args['proposal-id'] });
        output = 'Proposal sent.';
        break;
      case 'proposal':
        await runProposal({ leadId: args['lead-id'], services: args.services?.split(',') ?? [], budget: args.budget ?? '' });
        output = 'Proposal generated.';
        break;
      case 'sequence':
        await runSequencer({});
        output = 'Sequencer complete.';
        break;
      case 'analytics': {
        await runAnalytics({});
        const r = await query(
          `SELECT summary FROM analytics_snapshots ORDER BY created_at DESC LIMIT 1`
        );
        output = r.rows[0]?.summary ?? 'Analytics updated — check the dashboard for the full report.';
        break;
      }
      case 'check-replies': {
        await runReplyWatcher();
        const r = await query(
          `SELECT l.business_name, ar.classification, ar.body FROM replies ar JOIN leads l ON l.id = ar.lead_id WHERE ar.created_at >= $1 ORDER BY ar.created_at DESC LIMIT 10`,
          [since]
        );
        output = r.rows.length
          ? `Checked inbox — ${r.rows.length} new repl${r.rows.length === 1 ? 'y' : 'ies'}:\n` +
            r.rows.map(row => `- ${row.business_name} (${row.classification}): "${(row.body ?? '').slice(0, 80)}"`).join('\n')
          : 'Checked inbox — no new replies from leads.';
        break;
      }
      case 'daily':
        await runDailyPipeline();
        output = 'Daily pipeline complete.';
        break;
      case 'clean-knowledge':
        await runCleanKnowledge({ category: args.category, text: args.text });
        output = 'Knowledge cleaned.';
        break;
      default:
        ok = false;
        output = `Unknown command: ${command}`;
    }
  } catch (err) {
    ok = false;
    output = err?.message ?? String(err);
    console.error(`[agent-api] ✗ ${command}:`, err);
  }

  const lead_ids = res._scoutLeadIds ?? null;
  res.json({ ok, output, ...(lead_ids ? { lead_ids } : {}) });
});

// ── Reply watcher cron — every 30 min, 8am–8pm Ghana time ────────────────────
cron.schedule('*/30 8-20 * * *', async () => {
  try {
    await runReplyWatcher();
  } catch (err) {
    console.error('[cron] Reply watcher failed:', err.message);
  }
}, { timezone: 'Africa/Accra' });

// ── Daily pipeline cron — 7am Ghana time (UTC+0) ───────────────────────────────
cron.schedule('0 7 * * *', async () => {
  console.log('[cron] ⏰ Running daily pipeline...');
  try {
    await runDailyPipeline();
    console.log('[cron] ✅ Daily pipeline complete');
  } catch (err) {
    console.error('[cron] ✗ Daily pipeline failed:', err);
  }
}, { timezone: 'Africa/Accra' });

// ── Start Telegram bot polling ─────────────────────────────────────────────────
if (process.env.TELEGRAM_BOT_TOKEN) {
  runTelegramBot().catch(err => console.error('[telegram] Failed to start:', err.message));
}

app.listen(PORT, () => {
  console.log(`[server] Tedmark agent server running on port ${PORT}`);
  console.log(`[server] WhatsApp webhook: POST/GET /webhook`);
  console.log(`[server] Agent API:        POST /run/:command`);

  // Self-ping every 4 minutes to prevent Render free tier from spinning down
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
  if (SELF_URL) {
    setInterval(async () => {
      try {
        await fetch(`${SELF_URL}/health`);
        console.log('[keepalive] ping ok');
      } catch {
        // silently ignore — server is still running even if ping fails
      }
    }, 4 * 60 * 1000); // every 4 minutes
    console.log(`[keepalive] self-ping active → ${SELF_URL}/health`);
  }
});
