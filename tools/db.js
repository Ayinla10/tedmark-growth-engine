import pg from 'pg';
import dotenv from 'dotenv';
import { getCurrentAgencyId } from './agency.js';

dotenv.config();

const { Pool } = pg;

// Strip sslmode/channel_binding from the URL and set SSL explicitly, so the
// pg driver doesn't emit its "sslmode alias" deprecation warning.
function buildPoolConfig(url) {
  if (!url) return { allowExitOnIdle: true };
  const clean = url.replace(/[?&](sslmode|channel_binding)=[^&]*/g, '');
  return {
    connectionString: clean,
    ssl: { rejectUnauthorized: false },
    allowExitOnIdle: true,
  };
}

const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL));

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function insertLead(lead) {
  const {
    business_name,
    sector,
    location,
    website_url = null,
    phone = null,
    email = null,
    source = 'maps',
    social_url = null,
    discovery_evidence = null,
    agency_id = null,
    country = 'GH',
  } = lead;

  const resolvedAgencyId = agency_id ?? (await getCurrentAgencyId());

  const result = await query(
    `INSERT INTO leads (agency_id, business_name, sector, location, website_url, phone, email, source, social_url, discovery_evidence, status, country)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'raw', $11)
     RETURNING *`,
    [resolvedAgencyId, business_name, sector, location, website_url, phone, email, source, social_url, discovery_evidence ? JSON.stringify(discovery_evidence) : null, country]
  );

  return result.rows[0];
}

// Suffix-stripping pattern applied on both sides of the comparison so
// "Acme Ltd" and "Acme" are recognized as the same business, and location
// matching is fuzzy (containment either direction) since different
// discovery sources report location at different granularity — Maps gives
// a full formatted address, web-scout gives just the city.
const BUSINESS_SUFFIX_SQL = '\\s+(ltd|limited|gh|ghana|inc|co|company)\\.?$';

export async function findLeadByNameAndLocation(businessName, location, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM leads
     WHERE agency_id = $1
       AND regexp_replace(lower(trim(business_name)), $2, '', 'i') = regexp_replace(lower(trim($3)), $2, '', 'i')
       AND (
         lower(location) = lower($4)
         OR location ILIKE '%' || $4 || '%'
         OR $4 ILIKE '%' || location || '%'
       )
     LIMIT 1`,
    [id, BUSINESS_SUFFIX_SQL, businessName, location]
  );
  return result.rows[0] ?? null;
}

export async function getRawLeads(limit, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM leads WHERE agency_id = $1 AND status = 'raw' ORDER BY created_at ASC LIMIT $2`,
    [id, limit]
  );
  return result.rows;
}

export async function getQualifiedLeads(limit, minScore, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM leads WHERE agency_id = $1 AND status = 'qualified' AND score >= $2 ORDER BY score DESC LIMIT $3`,
    [id, minScore, limit]
  );
  return result.rows;
}

export async function updateLeadScore(id, score, scoreReason, recommendedService = null) {
  const result = await query(
    `UPDATE leads
     SET score = $1,
         score_reason = $2,
         recommended_service = $3,
         status = CASE WHEN status = 'raw' THEN 'qualified' ELSE status END,
         qualified_at = now()
     WHERE id = $4
     RETURNING *`,
    [score, scoreReason, recommendedService, id]
  );
  return result.rows[0];
}

export async function updateLeadSiteSignals(id, signals) {
  const result = await query(
    `UPDATE leads SET site_signals = $1 WHERE id = $2 RETURNING *`,
    [JSON.stringify(signals), id]
  );
  return result.rows[0];
}

export async function getLeadById(id) {
  const result = await query(`SELECT * FROM leads WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function insertOutreach(outreach) {
  const { lead_id, message_type, subject, body, status = 'draft', knowledge_ids = [] } = outreach;

  const result = await query(
    `INSERT INTO outreach (lead_id, message_type, subject, body, status, knowledge_ids)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [lead_id, message_type, subject, body, status, knowledge_ids]
  );

  return result.rows[0];
}

export async function getLeadsNeedingContactInfo(limit, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM leads
     WHERE agency_id = $1
       AND status != 'archived'
       AND enriched_at IS NULL
     ORDER BY created_at ASC
     LIMIT $2`,
    [id, limit]
  );
  return result.rows;
}

export async function markLeadEnriched(id) {
  const result = await query(
    `UPDATE leads SET enriched_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
}

export async function updateLeadContact(id, { email, phone }) {
  const result = await query(
    `UPDATE leads
     SET email = COALESCE($1, email),
         phone = COALESCE($2, phone)
     WHERE id = $3
     RETURNING *`,
    [email ?? null, phone ?? null, id]
  );
  return result.rows[0];
}

export async function getLeadsNeedingDmEnrichment(limit, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM leads
     WHERE agency_id = $1
       AND status != 'archived'
       AND website_url IS NOT NULL
       AND dm_enriched_at IS NULL
     ORDER BY created_at ASC
     LIMIT $2`,
    [id, limit]
  );
  return result.rows;
}

export async function updateLeadDecisionMaker(id, { dmName, dmTitle, dmEmail, dmPhone, dmLinkedinUrl, language }) {
  const result = await query(
    `UPDATE leads
     SET dm_name = COALESCE($1, dm_name),
         dm_title = COALESCE($2, dm_title),
         dm_email = COALESCE($3, dm_email),
         dm_phone = COALESCE($4, dm_phone),
         dm_linkedin_url = COALESCE($5, dm_linkedin_url),
         language = COALESCE($6, language),
         dm_enriched_at = now()
     WHERE id = $7
     RETURNING *`,
    [dmName ?? null, dmTitle ?? null, dmEmail ?? null, dmPhone ?? null, dmLinkedinUrl ?? null, language ?? null, id]
  );
  return result.rows[0];
}

export async function getLeadsNeedingIcpScore(limit, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM leads
     WHERE agency_id = $1
       AND status != 'archived'
       AND score IS NOT NULL
       AND icp_scored_at IS NULL
     ORDER BY score DESC, created_at ASC
     LIMIT $2`,
    [id, limit]
  );
  return result.rows;
}

export async function updateLeadIcpScore(id, { budget, authority, need, urgency, fit, reasoning }) {
  const total = budget + authority + need + urgency + fit;
  const result = await query(
    `UPDATE leads
     SET icp_budget = $1,
         icp_authority = $2,
         icp_need = $3,
         icp_urgency = $4,
         icp_fit = $5,
         icp_total = $6,
         icp_reasoning = $7,
         icp_scored_at = now()
     WHERE id = $8
     RETURNING *`,
    [budget, authority, need, urgency, fit, total, reasoning ?? null, id]
  );
  return result.rows[0];
}

export async function getTelegramStatusSummary(agencyId) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const [leads, outreach, proposals, dueActions] = await Promise.all([
    query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE created_at::date = now()::date)::int AS today,
         count(*) FILTER (WHERE status = 'raw')::int AS raw,
         count(*) FILTER (WHERE status = 'qualified')::int AS qualified,
         count(*) FILTER (WHERE status = 'contacted')::int AS contacted,
         round(avg(score) FILTER (WHERE score IS NOT NULL), 1)::float AS avg_score
       FROM leads WHERE agency_id = $1`,
      [id]
    ),
    query(
      `SELECT
         count(*) FILTER (WHERE o.status = 'draft')::int AS drafts,
         count(*) FILTER (WHERE o.status = 'sent' AND o.created_at::date = now()::date)::int AS sent_today,
         count(*) FILTER (WHERE o.replied)::int AS replied
       FROM outreach o JOIN leads l ON l.id = o.lead_id WHERE l.agency_id = $1`,
      [id]
    ),
    query(
      `SELECT count(*)::int AS total FROM proposals p JOIN leads l ON l.id = p.lead_id WHERE l.agency_id = $1`,
      [id]
    ),
    query(
      `SELECT count(*)::int AS n FROM leads
       WHERE agency_id = $1 AND next_action_due IS NOT NULL AND next_action_due <= now()::date AND status != 'archived'`,
      [id]
    ),
  ]);

  return {
    leadsTotal: leads.rows[0].total,
    leadsToday: leads.rows[0].today,
    raw: leads.rows[0].raw,
    qualified: leads.rows[0].qualified,
    contacted: leads.rows[0].contacted,
    avgScore: leads.rows[0].avg_score,
    drafts: outreach.rows[0].drafts,
    sentToday: outreach.rows[0].sent_today,
    replied: outreach.rows[0].replied,
    proposals: proposals.rows[0].total,
    dueOrOverdue: dueActions.rows[0].n,
  };
}

export async function findUserForTelegramLink(email) {
  if (email) {
    const result = await query(`SELECT id, email, agency_id FROM users WHERE email = $1`, [email]);
    return result.rows[0] ?? null;
  }
  const result = await query(`SELECT id, email, agency_id FROM users`);
  if (result.rows.length !== 1) return null; // ambiguous — caller must pass --email
  return result.rows[0];
}

export async function createTelegramLinkCode(userId, agencyId) {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await query(
    `INSERT INTO telegram_link_codes (user_id, agency_id, code, expires_at)
     VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [userId, agencyId, code]
  );
  return code;
}

export async function consumeTelegramLinkCode(code, telegramChatId, telegramUserId, telegramUsername) {
  const codeRow = await query(
    `SELECT * FROM telegram_link_codes WHERE code = $1 AND used_at IS NULL AND expires_at > now()`,
    [code]
  );
  const row = codeRow.rows[0];
  if (!row) return null;

  await query(`UPDATE telegram_link_codes SET used_at = now() WHERE id = $1`, [row.id]);

  const result = await query(
    `INSERT INTO telegram_links (user_id, agency_id, telegram_chat_id, telegram_user_id, telegram_username)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       telegram_chat_id = $3, telegram_user_id = $4, telegram_username = $5, active = true, linked_at = now()
     RETURNING *`,
    [row.user_id, row.agency_id, telegramChatId, telegramUserId, telegramUsername ?? null]
  );
  return result.rows[0];
}

export async function getTelegramLinkByChatId(chatId) {
  const result = await query(`SELECT * FROM telegram_links WHERE telegram_chat_id = $1 AND active = true`, [chatId]);
  return result.rows[0] ?? null;
}

export async function getActiveTelegramLinksForAgency(agencyId) {
  const result = await query(`SELECT * FROM telegram_links WHERE agency_id = $1 AND active = true`, [agencyId]);
  return result.rows;
}

export async function getAgencyIdsWithActiveTelegramLinks() {
  const result = await query(`SELECT DISTINCT agency_id FROM telegram_links WHERE active = true AND agency_id IS NOT NULL`);
  return result.rows.map((r) => r.agency_id);
}

export async function recordTelegramMessage(telegramLinkId, direction, body, context = null) {
  await query(
    `INSERT INTO telegram_messages (telegram_link_id, direction, body, context) VALUES ($1, $2, $3, $4)`,
    [telegramLinkId, direction, body, context ? JSON.stringify(context) : null]
  );
}

export async function getRecentTelegramMessages(telegramLinkId, limit = 5) {
  const result = await query(
    `SELECT * FROM telegram_messages WHERE telegram_link_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [telegramLinkId, limit]
  );
  return result.rows.reverse();
}

export async function getBusinessContextRow(agencyId) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(`SELECT * FROM business_context WHERE agency_id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function getHistoricalResults(agencyId) {
  const id = agencyId ?? (await getCurrentAgencyId());

  const [leads, outreach, proposals, deals, range] = await Promise.all([
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'qualified')::int AS qualified,
              count(*) FILTER (WHERE status = 'contacted')::int AS contacted,
              round(avg(score) FILTER (WHERE score IS NOT NULL), 1)::float AS avg_score
       FROM leads WHERE agency_id = $1`,
      [id]
    ),
    query(
      `SELECT count(*) FILTER (WHERE o.status = 'sent')::int AS sent,
              count(*) FILTER (WHERE o.replied)::int AS replied
       FROM outreach o JOIN leads l ON l.id = o.lead_id WHERE l.agency_id = $1`,
      [id]
    ),
    query(
      `SELECT count(*)::int AS total FROM proposals p JOIN leads l ON l.id = p.lead_id WHERE l.agency_id = $1`,
      [id]
    ),
    query(
      `SELECT count(*) FILTER (WHERE pipeline_stage = 'Won')::int AS won,
              count(*) FILTER (WHERE pipeline_stage = 'Lost')::int AS lost,
              coalesce(sum(deal_value) FILTER (WHERE pipeline_stage = 'Won'), 0)::float AS won_revenue,
              (array_agg(deal_currency) FILTER (WHERE pipeline_stage = 'Won' AND deal_currency IS NOT NULL))[1] AS currency
       FROM leads WHERE agency_id = $1`,
      [id]
    ),
    query(`SELECT min(created_at) AS earliest, max(created_at) AS latest FROM leads WHERE agency_id = $1`, [id]),
  ]);

  return {
    leadsTotal: leads.rows[0].total,
    qualified: leads.rows[0].qualified,
    contacted: leads.rows[0].contacted,
    avgScore: leads.rows[0].avg_score,
    outreachSent: outreach.rows[0].sent,
    replied: outreach.rows[0].replied,
    proposals: proposals.rows[0].total,
    dealsWon: deals.rows[0].won,
    dealsLost: deals.rows[0].lost,
    wonRevenue: deals.rows[0].won_revenue,
    revenueCurrency: deals.rows[0].currency,
    dataFrom: range.rows[0].earliest,
    dataTo: range.rows[0].latest,
  };
}

export async function hasOutreachForLead(leadId) {
  const result = await query(
    `SELECT 1 FROM outreach WHERE lead_id = $1 LIMIT 1`,
    [leadId]
  );
  return result.rows.length > 0;
}

export async function getOutreachById(id) {
  const result = await query(
    `SELECT o.*, l.business_name, l.email AS lead_email
     FROM outreach o
     JOIN leads l ON l.id = o.lead_id
     WHERE o.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function approveOutreach(id) {
  const result = await query(
    `UPDATE outreach SET status = 'approved' WHERE id = $1 AND status = 'draft' RETURNING *`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function markOutreachSent(id) {
  const result = await query(
    `UPDATE outreach SET status = 'sent', sent_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function markLeadContacted(id) {
  // Also advances the human-facing pipeline_stage, but only forward from
  // 'New' — a lead already moved further along (Qualified, Negotiating,
  // etc.) by a human shouldn't get silently reset just because another
  // message went out.
  const result = await query(
    `UPDATE leads SET
       status = 'contacted',
       pipeline_stage = CASE WHEN pipeline_stage = 'New' THEN 'Contacted' ELSE pipeline_stage END
     WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
}

export async function markPendingFollowUpsSent(leadId) {
  const result = await query(
    `UPDATE follow_ups SET status = 'sent', sent_at = now()
     WHERE lead_id = $1 AND status = 'pending'
     RETURNING *`,
    [leadId]
  );
  return result.rows;
}

export async function getOutreachAwaitingReply(daysSinceSent) {
  const result = await query(
    `SELECT o.*, l.business_name, l.sector, l.location
     FROM outreach o
     JOIN leads l ON l.id = o.lead_id
     WHERE o.status = 'sent'
       AND o.replied = false
       AND o.sent_at < now() - ($1 || ' days')::interval
       AND l.status != 'archived'`,
    [daysSinceSent]
  );
  return result.rows;
}

export async function getLatestFollowUp(leadId) {
  const result = await query(
    `SELECT * FROM follow_ups WHERE lead_id = $1 ORDER BY sequence_step DESC LIMIT 1`,
    [leadId]
  );
  return result.rows[0] ?? null;
}

export async function hasPendingFollowUp(leadId) {
  const result = await query(
    `SELECT 1 FROM follow_ups WHERE lead_id = $1 AND status = 'pending' LIMIT 1`,
    [leadId]
  );
  return result.rows.length > 0;
}

export async function insertFollowUp(followUp) {
  const { lead_id, sequence_step, scheduled_at, status = 'pending' } = followUp;

  const result = await query(
    `INSERT INTO follow_ups (lead_id, sequence_step, scheduled_at, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [lead_id, sequence_step, scheduled_at, status]
  );

  return result.rows[0];
}

export async function archiveLead(id) {
  const result = await query(
    `UPDATE leads SET status = 'archived' WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
}

export async function insertProposal(proposal) {
  const { lead_id, services, budget_range, content, knowledge_ids = [] } = proposal;

  const result = await query(
    `INSERT INTO proposals (lead_id, services, budget_range, content, knowledge_ids)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [lead_id, services, budget_range, content, knowledge_ids]
  );

  // Advance pipeline_stage forward only — a lead already in Negotiating,
  // Won, or Lost shouldn't get pulled back to "Proposal Sent" by a second
  // proposal going out.
  await query(
    `UPDATE leads SET pipeline_stage = 'Proposal Sent'
     WHERE id = $1 AND pipeline_stage IN ('New', 'Contacted', 'Qualified')`,
    [lead_id]
  );

  return result.rows[0];
}

export async function getProposalById(id) {
  const result = await query(
    `SELECT p.*, l.business_name, l.email AS lead_email
     FROM proposals p
     JOIN leads l ON l.id = p.lead_id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function seedScoutProgress(sector, city, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  await query(
    `INSERT INTO scout_progress (agency_id, sector, city) VALUES ($1, $2, $3)
     ON CONFLICT (agency_id, sector, city) DO NOTHING`,
    [id, sector, city]
  );
}

export async function getNextScoutBatch(limit, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM scout_progress
     WHERE agency_id = $1 AND exhausted = false
     ORDER BY last_run_at ASC NULLS FIRST
     LIMIT $2`,
    [id, limit]
  );
  return result.rows;
}

export async function recordScoutRun(id, { nextOffset, exhausted }) {
  const result = await query(
    `UPDATE scout_progress
     SET next_offset = $1, exhausted = $2, last_run_at = now()
     WHERE id = $3
     RETURNING *`,
    [nextOffset, exhausted, id]
  );
  return result.rows[0];
}

export async function seedSearchProgress(sector, city, queryType, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  await query(
    `INSERT INTO search_progress (agency_id, sector, city, query_type) VALUES ($1, $2, $3, $4)
     ON CONFLICT (agency_id, sector, city, query_type) DO NOTHING`,
    [id, sector, city, queryType]
  );
}

export async function getNextSearchBatch(limit, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM search_progress
     WHERE agency_id = $1 AND exhausted = false
     ORDER BY last_run_at ASC NULLS FIRST
     LIMIT $2`,
    [id, limit]
  );
  return result.rows;
}

export async function recordSearchRun(id, { nextOffset, exhausted }) {
  const result = await query(
    `UPDATE search_progress
     SET next_offset = $1, exhausted = $2, last_run_at = now()
     WHERE id = $3
     RETURNING *`,
    [nextOffset, exhausted, id]
  );
  return result.rows[0];
}

export async function recordApiUsage(provider, operation, unit, quantity, agencyId = null) {
  if (!quantity) return;
  const id = agencyId ?? (await getCurrentAgencyId());
  await query(
    `INSERT INTO api_usage (agency_id, provider, operation, unit, quantity) VALUES ($1, $2, $3, $4, $5)`,
    [id, provider, operation, unit, quantity]
  );
}

export async function recordSearchApiUsage(provider, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  await query(`INSERT INTO search_api_usage (agency_id, provider) VALUES ($1, $2)`, [id, provider]);
  await recordApiUsage(provider, 'search', 'requests', 1, id);
}

export async function getSearchApiUsageThisMonth(provider, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT count(*)::int AS n FROM search_api_usage
     WHERE agency_id = $1 AND provider = $2 AND used_at >= date_trunc('month', now())`,
    [id, provider]
  );
  return result.rows[0].n;
}

export async function findLeadByEmail(email, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM leads WHERE agency_id = $1 AND lower(email) = lower($2) LIMIT 1`,
    [id, email]
  );
  return result.rows[0] ?? null;
}

export async function replyExistsForMessageId(messageId) {
  if (!messageId) return false;
  const result = await query(`SELECT id FROM replies WHERE message_id = $1 LIMIT 1`, [messageId]);
  return result.rows.length > 0;
}

export async function insertAutoReply({ leadId, outreachId, body, fromEmail, messageId, classification, draftOutreachId }) {
  const result = await query(
    `INSERT INTO replies (lead_id, outreach_id, body, from_email, message_id, classification, draft_outreach_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [leadId, outreachId ?? null, body, fromEmail, messageId, classification, draftOutreachId ?? null]
  );
  if (outreachId) {
    await query(`UPDATE outreach SET replied = true WHERE id = $1`, [outreachId]);
  }
  return result.rows[0];
}

export async function getLatestOutreachForLead(leadId) {
  const result = await query(
    `SELECT * FROM outreach WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [leadId]
  );
  return result.rows[0] ?? null;
}

export async function getSignatures(agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(`SELECT * FROM signatures WHERE agency_id = $1 ORDER BY is_default DESC, created_at ASC`, [id]);
  return result.rows;
}

export async function getSignatureById(id) {
  const result = await query(`SELECT * FROM signatures WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function getDefaultSignature(agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(`SELECT * FROM signatures WHERE agency_id = $1 AND is_default = true LIMIT 1`, [id]);
  return result.rows[0] ?? null;
}

export async function insertSignature({ label, body, isDefault = false, agencyId = null }) {
  const id = agencyId ?? (await getCurrentAgencyId());
  // Only one default signature per agency — clearing is scoped to this
  // agency alone so it never touches another agency's default.
  if (isDefault) {
    await query(`UPDATE signatures SET is_default = false WHERE agency_id = $1`, [id]);
  }
  const result = await query(
    `INSERT INTO signatures (agency_id, label, body, is_default) VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, label, body, isDefault]
  );
  return result.rows[0];
}

export async function updateSignature(id, { label, body }) {
  const result = await query(
    `UPDATE signatures SET label = $1, body = $2 WHERE id = $3 RETURNING *`,
    [label, body, id]
  );
  return result.rows[0] ?? null;
}

export async function setDefaultSignature(id) {
  const result = await query(`UPDATE signatures SET is_default = true WHERE id = $1 RETURNING *`, [id]);
  const row = result.rows[0];
  if (row) {
    await query(`UPDATE signatures SET is_default = false WHERE agency_id = $1 AND id != $2`, [row.agency_id, id]);
  }
  return row ?? null;
}

export async function deleteSignature(id) {
  const result = await query(`DELETE FROM signatures WHERE id = $1 RETURNING id`, [id]);
  return result.rows[0] ?? null;
}

export async function seedDirectoryProgress(categorySlug, sector, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  await query(
    `INSERT INTO directory_progress (agency_id, category_slug, sector) VALUES ($1, $2, $3)
     ON CONFLICT (agency_id, category_slug) DO NOTHING`,
    [id, categorySlug, sector]
  );
}

export async function getNextDirectoryBatch(limit, agencyId = null) {
  const id = agencyId ?? (await getCurrentAgencyId());
  const result = await query(
    `SELECT * FROM directory_progress
     WHERE agency_id = $1 AND exhausted = false
     ORDER BY last_run_at ASC NULLS FIRST
     LIMIT $2`,
    [id, limit]
  );
  return result.rows;
}

export async function recordDirectoryRun(id, { nextPage, exhausted }) {
  const result = await query(
    `UPDATE directory_progress
     SET next_page = $1, exhausted = $2, last_run_at = now()
     WHERE id = $3
     RETURNING *`,
    [nextPage, exhausted, id]
  );
  return result.rows[0];
}

export default pool;
