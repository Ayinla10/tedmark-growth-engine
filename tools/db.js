import pg from 'pg';
import dotenv from 'dotenv';

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
  } = lead;

  const result = await query(
    `INSERT INTO leads (business_name, sector, location, website_url, phone, email, source, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'raw')
     RETURNING *`,
    [business_name, sector, location, website_url, phone, email, source]
  );

  return result.rows[0];
}

export async function findLeadByNameAndLocation(businessName, location) {
  const result = await query(
    `SELECT * FROM leads WHERE business_name = $1 AND location = $2 LIMIT 1`,
    [businessName, location]
  );
  return result.rows[0] ?? null;
}

export async function getRawLeads(limit) {
  const result = await query(
    `SELECT * FROM leads WHERE status = 'raw' ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getQualifiedLeads(limit, minScore) {
  const result = await query(
    `SELECT * FROM leads WHERE status = 'qualified' AND score >= $1 ORDER BY score DESC LIMIT $2`,
    [minScore, limit]
  );
  return result.rows;
}

export async function updateLeadScore(id, score, scoreReason) {
  const result = await query(
    `UPDATE leads
     SET score = $1,
         score_reason = $2,
         status = CASE WHEN status = 'raw' THEN 'qualified' ELSE status END,
         qualified_at = now()
     WHERE id = $3
     RETURNING *`,
    [score, scoreReason, id]
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

export async function getLeadsNeedingContactInfo(limit) {
  const result = await query(
    `SELECT * FROM leads
     WHERE status != 'archived'
       AND enriched_at IS NULL
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
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
  const result = await query(
    `UPDATE leads SET status = 'contacted' WHERE id = $1 RETURNING *`,
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

  return result.rows[0];
}

export async function seedScoutProgress(sector, city) {
  await query(
    `INSERT INTO scout_progress (sector, city) VALUES ($1, $2)
     ON CONFLICT (sector, city) DO NOTHING`,
    [sector, city]
  );
}

export async function getNextScoutBatch(limit) {
  const result = await query(
    `SELECT * FROM scout_progress
     WHERE exhausted = false
     ORDER BY last_run_at ASC NULLS FIRST
     LIMIT $1`,
    [limit]
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

export async function seedSearchProgress(sector, city, queryType) {
  await query(
    `INSERT INTO search_progress (sector, city, query_type) VALUES ($1, $2, $3)
     ON CONFLICT (sector, city, query_type) DO NOTHING`,
    [sector, city, queryType]
  );
}

export async function getNextSearchBatch(limit) {
  const result = await query(
    `SELECT * FROM search_progress
     WHERE exhausted = false
     ORDER BY last_run_at ASC NULLS FIRST
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function recordSearchRun(id, { nextStart, exhausted }) {
  const result = await query(
    `UPDATE search_progress
     SET next_start = $1, exhausted = $2, last_run_at = now()
     WHERE id = $3
     RETURNING *`,
    [nextStart, exhausted, id]
  );
  return result.rows[0];
}

export default pool;
