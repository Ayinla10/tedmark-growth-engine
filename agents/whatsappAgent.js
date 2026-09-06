/**
 * WhatsApp AI Agent
 * Handles two distinct caller types:
 *  1. OWNER  — your personal WhatsApp number controls the whole system
 *  2. LEAD   — a prospect/client replying to outreach is logged to their thread
 */

import {
  getTelegramStatusSummary,
  getQualifiedLeads,
  getLeadById,
} from '../tools/db.js';
import { setSetting } from '../tools/settings.js';
import { complete } from '../tools/llm.js';
import { query } from '../tools/db.js';

// Resolve the owner's agency ID — set WHATSAPP_AGENCY_ID explicitly, or we
// fall back to the first agency row in the database (single-tenant default).
async function getOwnerAgencyId() {
  if (process.env.WHATSAPP_AGENCY_ID) return process.env.WHATSAPP_AGENCY_ID;
  const res = await query('SELECT id FROM agencies ORDER BY created_at LIMIT 1');
  return res.rows[0]?.id ?? null;
}

const TOKEN            = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID  = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OWNER_PHONE      = process.env.WHATSAPP_OWNER_PHONE; // E.164, no +, e.g. 233244123456

// ── Send a WhatsApp message via Meta Cloud API ─────────────────────────────────
export async function sendWhatsApp(to, text) {
  if (!TOKEN || !PHONE_NUMBER_ID) {
    console.warn('[whatsapp] Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID — cannot send');
    return;
  }
  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    console.error('[whatsapp] Send failed:', err);
  }
}

// ── Owner command intents ──────────────────────────────────────────────────────
const OWNER_INTENTS = [
  'pipeline',   // active deal summary
  'deals',      // list active deals
  'attention',  // deals needing action
  'status',     // today's lead activity
  'leads',      // top qualified leads
  'pause',      // pause scout
  'resume',     // resume scout
  'approve',    // approve all pending outreach
  'help',
  'unknown',
];

const OWNER_HELP = `*Tedmark Growth AI — WhatsApp Control*

*Pipeline commands:*
• pipeline / deals — active deal summary
• attention — deals needing action

*Lead commands:*
• status — today's activity snapshot
• leads — top qualified leads
• approve all — approve all pending outreach drafts
• pause / resume — toggle lead discovery

*Natural language works too:*
"how are we doing?"
"what needs attention?"
"show me today's leads"`;

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmtMoney(value, currency) {
  if (!value) return '';
  return ` ${currency ?? ''}${Number(value).toLocaleString()}`;
}

async function formatPipeline(agencyId) {
  const res = await query(
    `SELECT business_name, pipeline_stage, deal_value, deal_currency,
            next_action_due, last_outreach_at
     FROM leads
     WHERE agency_id = $1
       AND status != 'archived'
       AND pipeline_stage IN ('Qualified', 'Proposal Sent', 'Negotiating', 'Won', 'Lost')
     ORDER BY deal_value DESC NULLS LAST
     LIMIT 20`,
    [agencyId]
  );
  const deals = res.rows;
  if (!deals.length) return 'No deals in your pipeline yet.';

  const active = deals.filter(d => ['Qualified', 'Proposal Sent', 'Negotiating'].includes(d.pipeline_stage));
  const won    = deals.filter(d => d.pipeline_stage === 'Won');
  const lost   = deals.filter(d => d.pipeline_stage === 'Lost');

  const pipelineValue = active.reduce((s, d) => s + (Number(d.deal_value) || 0), 0);
  const wonValue      = won.reduce((s, d) => s + (Number(d.deal_value) || 0), 0);
  const currency      = active[0]?.deal_currency ?? won[0]?.deal_currency ?? '';

  const lines = ['*DEALS PIPELINE*', ''];
  lines.push(`Active: ${active.length}  |  Value: ${currency}${pipelineValue.toLocaleString()}`);
  if (won.length) lines.push(`Won: ${won.length}  |  ${currency}${wonValue.toLocaleString()}`);
  lines.push('');

  for (const d of active) {
    const overdue = d.next_action_due && new Date(d.next_action_due) < new Date();
    lines.push(`${overdue ? '⚠️ ' : ''}*${d.business_name}*${fmtMoney(d.deal_value, d.deal_currency)} — ${d.pipeline_stage}`);
  }
  return lines.join('\n');
}

async function formatAttention(agencyId) {
  const res = await query(
    `SELECT business_name, pipeline_stage, deal_value, deal_currency,
            next_action_due, last_outreach_at
     FROM leads
     WHERE agency_id = $1
       AND status != 'archived'
       AND pipeline_stage IN ('Qualified', 'Proposal Sent', 'Negotiating')`,
    [agencyId]
  );
  const now = Date.now();
  const DAY = 86400000;

  const flagged = res.rows
    .map(d => {
      const daysSince = d.last_outreach_at
        ? Math.floor((now - new Date(d.last_outreach_at).getTime()) / DAY)
        : null;
      const overdue = d.next_action_due && new Date(d.next_action_due) < new Date();

      let signal = null;
      if (overdue) signal = 'Action overdue';
      else if (d.pipeline_stage === 'Proposal Sent' && daysSince >= 3) signal = `${daysSince}d since proposal — follow up`;
      else if (d.pipeline_stage === 'Negotiating'   && daysSince >= 5) signal = `Stalled — ${daysSince}d no activity`;
      else if (d.pipeline_stage === 'Qualified'     && daysSince >= 7) signal = `Going cold — ${daysSince}d no contact`;

      return signal ? { ...d, signal } : null;
    })
    .filter(Boolean);

  if (!flagged.length) return '✅ Nothing needs your attention right now.';

  const lines = ['*NEEDS ATTENTION*', ''];
  for (const d of flagged) {
    lines.push(`⚠️ *${d.business_name}*${fmtMoney(d.deal_value, d.deal_currency)}\n   ${d.signal}`);
  }
  return lines.join('\n');
}

async function formatStatus(agencyId) {
  const s = await getTelegramStatusSummary(agencyId);
  return [
    "*TODAY'S PERFORMANCE*", '',
    `Leads found today: ${s.leadsToday}`,
    `Total leads: ${s.leadsTotal}`,
    `Qualified: ${s.qualified}`,
    `Avg score: ${s.avgScore ?? '—'}`,
    `Outreach drafts pending: ${s.drafts}`,
    `Sent today: ${s.sentToday}`,
    `Replies: ${s.replied}`,
    `Proposals: ${s.proposals}`,
    s.dueOrOverdue > 0 ? `\n⚠️ ${s.dueOrOverdue} action${s.dueOrOverdue === 1 ? '' : 's'} due or overdue` : '',
  ].filter(Boolean).join('\n');
}

async function formatTopLeads(agencyId) {
  const leads = await getQualifiedLeads(5, 6, agencyId);
  if (!leads.length) return 'No qualified leads with score ≥ 6 right now.';
  const lines = ['*TOP QUALIFIED LEADS*', ''];
  for (const l of leads) {
    lines.push(`*${l.business_name}* — ${l.score}/10\n${l.score_reason ?? ''}`);
  }
  return lines.join('\n\n');
}

async function approveAllDrafts(agencyId) {
  const res = await query(
    `UPDATE outreach SET status = 'approved'
     WHERE agency_id = $1 AND status = 'draft'
     RETURNING id`,
    [agencyId]
  );
  const count = res.rowCount ?? 0;
  return count > 0
    ? `✅ ${count} draft${count === 1 ? '' : 's'} approved. Go to Outreach to send them.`
    : 'No drafts waiting for approval.';
}

// ── Intent classifier ──────────────────────────────────────────────────────────
async function classifyOwnerIntent(text) {
  const lower = text.trim().toLowerCase();

  // Fast keyword matches
  if (/^(pipeline|deals?)$/.test(lower))             return 'pipeline';
  if (/attention|urgent|overdue|stall/i.test(lower)) return 'attention';
  if (/^status$/.test(lower))                        return 'status';
  if (/^leads?$/.test(lower))                        return 'leads';
  if (/^pause/.test(lower))                          return 'pause';
  if (/^resume/.test(lower))                         return 'resume';
  if (/approve.*(all)?/i.test(lower))               return 'approve';
  if (/^help$/.test(lower))                          return 'help';

  // Natural language → AI classification
  try {
    const raw = await complete({
      system: `Classify this message into one of: ${OWNER_INTENTS.join(', ')}. Reply with only the intent word.`,
      user: text,
      maxTokens: 20,
    });
    const intent = raw.trim().toLowerCase();
    return OWNER_INTENTS.includes(intent) ? intent : 'unknown';
  } catch {
    return 'unknown';
  }
}

// ── Owner command handler ──────────────────────────────────────────────────────
async function handleOwnerMessage(from, text, agencyId) {
  let response;
  const intent = await classifyOwnerIntent(text);

  switch (intent) {
    case 'pipeline':
    case 'deals':
      response = await formatPipeline(agencyId);
      break;
    case 'attention':
      response = await formatAttention(agencyId);
      break;
    case 'status':
      response = await formatStatus(agencyId);
      break;
    case 'leads':
      response = await formatTopLeads(agencyId);
      break;
    case 'pause':
      await setSetting('scout_enabled', false, agencyId);
      await setSetting('web_scout_enabled', false, agencyId);
      response = '⏸ Lead discovery paused.';
      break;
    case 'resume':
      await setSetting('scout_enabled', true, agencyId);
      await setSetting('web_scout_enabled', true, agencyId);
      response = '▶️ Lead discovery resumed.';
      break;
    case 'approve':
      response = await approveAllDrafts(agencyId);
      break;
    case 'help':
      response = OWNER_HELP;
      break;
    default:
      response = "Didn't catch that. Send *help* to see what I can do.";
  }

  await sendWhatsApp(from, response);
}

// ── Lead reply handler ─────────────────────────────────────────────────────────
async function handleLeadMessage(from, text) {
  // Normalise: strip leading +, spaces
  const phone = from.replace(/\D/g, '');

  // Find the lead by phone number (dm_phone or phone column)
  const res = await query(
    `SELECT id, business_name, agency_id FROM leads
     WHERE (regexp_replace(COALESCE(dm_phone, phone, ''), '[^0-9]', '', 'g') LIKE $1
         OR regexp_replace(COALESCE(dm_phone, phone, ''), '[^0-9]', '', 'g') LIKE $2)
       AND status != 'archived'
     LIMIT 1`,
    [`%${phone.slice(-9)}`, `%${phone}`]   // match last 9 digits — handles country code variants
  );

  if (!res.rows.length) {
    console.log(`[whatsapp] Lead not found for number ${from} — ignoring`);
    return;
  }

  const lead = res.rows[0];

  // Log as inbound reply in the outreach table
  await query(
    `INSERT INTO outreach (lead_id, agency_id, subject, body, status, channel, is_reply, created_at)
     VALUES ($1, $2, 'WhatsApp reply', $3, 'sent', 'whatsapp', true, NOW())`,
    [lead.id, lead.agency_id, text ?? '[non-text message]']
  );

  // Update last_outreach_at so attention logic knows there was recent activity
  await query(
    `UPDATE leads SET last_outreach_at = NOW() WHERE id = $1`,
    [lead.id]
  );

  console.log(`[whatsapp] Logged reply from ${lead.business_name} (${from})`);
}

// ── Main entry point ───────────────────────────────────────────────────────────
export async function handleIncomingWhatsApp({ from, text, type, msgId }) {
  if (!text) {
    console.log(`[whatsapp] Non-text message (${type}) from ${from} — skipped`);
    return;
  }

  const ownerPhone = OWNER_PHONE?.replace(/\D/g, '');
  const senderPhone = from?.replace(/\D/g, '');

  if (ownerPhone && senderPhone === ownerPhone) {
    // Owner is talking to the system
    const agencyId = await getOwnerAgencyId();
    await handleOwnerMessage(from, text, agencyId);
  } else {
    // A lead is replying
    await handleLeadMessage(from, text);
  }
}
