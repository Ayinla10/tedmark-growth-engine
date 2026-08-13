import { readFile } from "fs/promises";
import path from "path";
import pool from "./db";
import { getCurrentAgencyId } from "./agency";
import { KNOWLEDGE_CATEGORIES } from "./knowledge-constants";
import { toISODateString } from "./time";
import { getSettings } from "./settings";

// pg returns `date` columns as JS Date objects, which React can't render
// directly — normalize to a plain "YYYY-MM-DD" string for every lead row.
function normalizeLead<T extends { next_action_due?: unknown }>(row: T): T {
  return { ...row, next_action_due: toISODateString(row.next_action_due) };
}

const BACKEND_ROOT = process.env.BACKEND_ROOT || "D:\\tedmark-growth-engine";

export async function getScoringProtocol(): Promise<string> {
  try {
    const raw = await readFile(path.join(BACKEND_ROOT, "prompts", "qualify.md"), "utf-8");
    const match = raw.match(/## Scoring guide([\s\S]*?)(?:\n##|$)/);
    return (match?.[1] ?? raw).trim();
  } catch {
    return "";
  }
}

export async function getLeadDetail(leadId: string) {
  const [lead, proposals, outreach] = await Promise.all([
    pool.query(`SELECT * FROM leads WHERE id = $1`, [leadId]),
    pool.query(`SELECT * FROM proposals WHERE lead_id = $1 ORDER BY created_at DESC`, [leadId]),
    pool.query(`SELECT * FROM outreach WHERE lead_id = $1 ORDER BY created_at DESC`, [leadId]),
  ]);

  return {
    lead: lead.rows[0] ? normalizeLead(lead.rows[0]) : null,
    proposals: proposals.rows,
    outreach: outreach.rows,
  };
}

export type SiteSignals = {
  mobileFriendly: boolean;
  hasTrackingPixel: boolean;
  hasClearCta: boolean;
  hasBookingSystem: boolean;
  hasChatWidget: boolean;
  hasEmailCapture: boolean;
  hasSocialLinks: boolean;
  hasEcommerce: boolean;
  hasH1: boolean;
  hasMetaDescription: boolean;
  hasSsl: boolean | null;
  cms: string | null;
  hasBlog: boolean;
  copyrightYear: number | null;
  looksOutdated: boolean;
};

export type DiscoveryEvidence = {
  query: string;
  title: string;
  link: string;
  snippet: string;
};

export type Lead = {
  id: string;
  business_name: string;
  sector: string | null;
  location: string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  score: number | null;
  score_reason: string | null;
  status: string;
  source: string;
  site_signals: SiteSignals | null;
  recommended_service: string | null;
  recommended_services: string[];
  problems: string[];
  social_url: string | null;
  discovery_evidence: DiscoveryEvidence | null;
  created_at: string;
  pipeline_stage: string;
  next_action: string | null;
  next_action_due: string | null;
  dm_name: string | null;
  dm_title: string | null;
  dm_email: string | null;
  dm_phone: string | null;
  dm_linkedin_url: string | null;
  language: string;
  icp_budget: number | null;
  icp_authority: number | null;
  icp_need: number | null;
  icp_urgency: number | null;
  icp_fit: number | null;
  icp_total: number | null;
  icp_reasoning: string | null;
  country: string;
};

export const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiating",
  "Won",
  "Lost",
] as const;

export type OutreachRow = {
  id: string;
  lead_id: string;
  business_name: string;
  lead_email: string | null;
  lead_phone: string | null;
  message_type: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  opened: boolean;
  replied: boolean;
  knowledge_ids: string[];
  created_at: string;
};

export type FollowUpRow = {
  id: string;
  lead_id: string;
  business_name: string;
  sequence_step: number;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
};

export type ProposalRow = {
  id: string;
  lead_id: string;
  business_name: string;
  lead_email: string | null;
  services: string[] | null;
  budget_range: string | null;
  content: string | null;
  knowledge_ids: string[];
  created_at: string;
};

export type KpiSummary = {
  leadsTotal: number;
  leadsToday: number;
  qualified: number;
  avgScore: number | null;
  drafts: number;
  contacted: number;
  replied: number;
  proposals: number;
  pendingFollowUps: number;
  funnel: { raw: number; qualified: number; contacted: number; archived: number };
};

export async function getKpiSummary(): Promise<KpiSummary> {
  const agencyId = await getCurrentAgencyId();
  const [leads, outreach, proposals, followUps] = await Promise.all([
    pool.query(
      `
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE created_at::date = now()::date)::int AS today,
        count(*) FILTER (WHERE status = 'raw')::int AS raw,
        count(*) FILTER (WHERE status = 'qualified')::int AS qualified,
        count(*) FILTER (WHERE status = 'contacted')::int AS contacted,
        count(*) FILTER (WHERE status = 'archived')::int AS archived,
        round(avg(score) FILTER (WHERE score IS NOT NULL), 1)::float AS avg_score
      FROM leads
      WHERE agency_id = $1
    `,
      [agencyId]
    ),
    pool.query(
      `
      SELECT
        count(*) FILTER (WHERE o.status = 'draft')::int AS drafts,
        count(*) FILTER (WHERE o.replied)::int AS replied
      FROM outreach o
      JOIN leads l ON l.id = o.lead_id
      WHERE l.agency_id = $1
    `,
      [agencyId]
    ),
    pool.query(
      `SELECT count(*)::int AS total
       FROM proposals p
       JOIN leads l ON l.id = p.lead_id
       WHERE l.agency_id = $1`,
      [agencyId]
    ),
    pool.query(
      `SELECT count(*) FILTER (WHERE f.status = 'pending')::int AS pending
       FROM follow_ups f
       JOIN leads l ON l.id = f.lead_id
       WHERE l.agency_id = $1`,
      [agencyId]
    ),
  ]);

  const l = leads.rows[0];
  const o = outreach.rows[0];

  return {
    leadsTotal: l.total,
    leadsToday: l.today,
    qualified: l.qualified,
    avgScore: l.avg_score,
    drafts: o.drafts,
    contacted: l.contacted,
    replied: o.replied,
    proposals: proposals.rows[0].total,
    pendingFollowUps: followUps.rows[0].pending,
    funnel: { raw: l.raw, qualified: l.qualified, contacted: l.contacted, archived: l.archived },
  };
}

export type AgentActivity = {
  scoutLastRunAt: string | null;
  scoutCombosRemaining: number;
  scoutCombosTotal: number;
  qualifierLastRunAt: string | null;
  outreachLastDraftAt: string | null;
  sequencerLastRunAt: string | null;
  proposalLastRunAt: string | null;
  analyticsLastRunAt: string | null;
};

export async function getAgentActivity(): Promise<AgentActivity> {
  const [scout, qualifier, outreach, sequencer, proposal, analytics] = await Promise.all([
    pool.query(`
      SELECT
        max(last_run_at) AS last_run_at,
        count(*) FILTER (WHERE exhausted = false)::int AS remaining,
        count(*)::int AS total
      FROM scout_progress
    `),
    pool.query(`SELECT max(qualified_at) AS last_run_at FROM leads`),
    pool.query(`SELECT max(created_at) AS last_run_at FROM outreach`),
    pool.query(`SELECT max(scheduled_at) AS last_run_at FROM follow_ups`),
    pool.query(`SELECT max(created_at) AS last_run_at FROM proposals`),
    pool.query(`SELECT max(created_at) AS last_run_at FROM analytics_snapshots`),
  ]);

  return {
    scoutLastRunAt: scout.rows[0].last_run_at,
    scoutCombosRemaining: scout.rows[0].remaining,
    scoutCombosTotal: scout.rows[0].total,
    qualifierLastRunAt: qualifier.rows[0].last_run_at,
    outreachLastDraftAt: outreach.rows[0].last_run_at,
    sequencerLastRunAt: sequencer.rows[0].last_run_at,
    proposalLastRunAt: proposal.rows[0].last_run_at,
    analyticsLastRunAt: analytics.rows[0].last_run_at,
  };
}

export type AnalyticsSnapshot = {
  summary: string;
  insights: {
    sectors: { sector: string; total: number; avg_score: number | null; contacted: number }[];
    channels: { channel: string; sent: number; replied: number; replyRate: number | null }[];
    funnel: { totalLeads: number; qualifyRate: number | null; contactRate: number | null };
  };
  created_at: string;
};

export async function getLatestAnalyticsSnapshot(): Promise<AnalyticsSnapshot | null> {
  const res = await pool.query(
    `SELECT summary, insights, created_at FROM analytics_snapshots ORDER BY created_at DESC LIMIT 1`
  );
  return res.rows[0] ?? null;
}

export type GrowthStats = {
  leadsToday: number;
  leadsYesterday: number;
  qualifiedToday: number;
  qualifiedYesterday: number;
  outreachSentToday: number;
  outreachSentYesterday: number;
  proposalsThisWeek: number;
  proposalsLastWeek: number;
};

export async function getGrowthStats(): Promise<GrowthStats> {
  const [leads, outreach, proposals] = await Promise.all([
    pool.query(`
      SELECT
        count(*) FILTER (WHERE created_at::date = now()::date)::int AS leads_today,
        count(*) FILTER (WHERE created_at::date = now()::date - 1)::int AS leads_yesterday,
        count(*) FILTER (WHERE qualified_at::date = now()::date)::int AS qualified_today,
        count(*) FILTER (WHERE qualified_at::date = now()::date - 1)::int AS qualified_yesterday
      FROM leads
    `),
    pool.query(`
      SELECT
        count(*) FILTER (WHERE sent_at::date = now()::date)::int AS sent_today,
        count(*) FILTER (WHERE sent_at::date = now()::date - 1)::int AS sent_yesterday
      FROM outreach
    `),
    pool.query(`
      SELECT
        count(*) FILTER (WHERE created_at >= date_trunc('week', now()))::int AS this_week,
        count(*) FILTER (WHERE created_at >= date_trunc('week', now()) - interval '7 days'
                           AND created_at < date_trunc('week', now()))::int AS last_week
      FROM proposals
    `),
  ]);

  return {
    leadsToday: leads.rows[0].leads_today,
    leadsYesterday: leads.rows[0].leads_yesterday,
    qualifiedToday: leads.rows[0].qualified_today,
    qualifiedYesterday: leads.rows[0].qualified_yesterday,
    outreachSentToday: outreach.rows[0].sent_today,
    outreachSentYesterday: outreach.rows[0].sent_yesterday,
    proposalsThisWeek: proposals.rows[0].this_week,
    proposalsLastWeek: proposals.rows[0].last_week,
  };
}

export { KNOWLEDGE_CATEGORIES, KNOWLEDGE_AGENTS } from "./knowledge-constants";

export type KnowledgeItem = {
  id: string;
  title: string;
  category: string;
  content: string;
  applicable_agents: string[];
  target_audience: string | null;
  tags: string[];
  source: string | null;
  approved: boolean;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

export async function getKnowledgeItems(search?: string): Promise<KnowledgeItem[]> {
  const agencyId = await getCurrentAgencyId();
  const params: unknown[] = [agencyId];
  let where = " WHERE agency_id = $1";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (title ILIKE $2 OR content ILIKE $2 OR $2 = ANY(tags))`;
  }
  const res = await pool.query(
    `SELECT * FROM knowledge_items${where} ORDER BY updated_at DESC LIMIT 200`,
    params
  );
  return res.rows;
}

export async function getKnowledgeItemById(id: string): Promise<KnowledgeItem | null> {
  const res = await pool.query(`SELECT * FROM knowledge_items WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

export type Signature = {
  id: string;
  label: string;
  body: string;
  is_default: boolean;
  created_at: string;
};

export async function getSignatures(): Promise<Signature[]> {
  const agencyId = await getCurrentAgencyId();
  const res = await pool.query(
    `SELECT * FROM signatures WHERE agency_id = $1 ORDER BY is_default DESC, created_at ASC`,
    [agencyId]
  );
  return res.rows;
}

export type KnowledgeRef = { id: string; title: string; category: string };

// Resolves a list of knowledge_ids (as stored on an outreach/proposal row)
// into their titles, for showing "Informed by: ..." badges without another
// round trip per row.
export async function getKnowledgeRefs(ids: string[]): Promise<KnowledgeRef[]> {
  if (ids.length === 0) return [];
  const res = await pool.query(
    `SELECT id, title, category FROM knowledge_items WHERE id = ANY($1)`,
    [ids]
  );
  return res.rows;
}

export type KnowledgeUsage = {
  outreachCount: number;
  proposalCount: number;
  recentOutreach: { id: string; lead_id: string; business_name: string; created_at: string }[];
  recentProposals: { id: string; lead_id: string; business_name: string; created_at: string }[];
};

export async function getKnowledgeUsage(id: string): Promise<KnowledgeUsage> {
  const [outreachCount, proposalCount, recentOutreach, recentProposals] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n FROM outreach WHERE $1 = ANY(knowledge_ids)`, [id]),
    pool.query(`SELECT count(*)::int AS n FROM proposals WHERE $1 = ANY(knowledge_ids)`, [id]),
    pool.query(
      `SELECT o.id, o.lead_id, l.business_name, o.created_at
       FROM outreach o JOIN leads l ON l.id = o.lead_id
       WHERE $1 = ANY(o.knowledge_ids)
       ORDER BY o.created_at DESC LIMIT 5`,
      [id]
    ),
    pool.query(
      `SELECT p.id, p.lead_id, l.business_name, p.created_at
       FROM proposals p JOIN leads l ON l.id = p.lead_id
       WHERE $1 = ANY(p.knowledge_ids)
       ORDER BY p.created_at DESC LIMIT 5`,
      [id]
    ),
  ]);

  return {
    outreachCount: outreachCount.rows[0].n,
    proposalCount: proposalCount.rows[0].n,
    recentOutreach: recentOutreach.rows,
    recentProposals: recentProposals.rows,
  };
}

export type KnowledgeItemWithUsage = {
  id: string;
  title: string;
  category: string;
  status: "draft" | "published";
  applicable_agents: string[];
  updated_at: string;
  usageCount: number;
  replyRate: number | null;
  lastUsedAt: string | null;
};

// Real per-item usage stats for the "performance" table — no fabricated
// metrics, just genuine counts joined off the same knowledge_ids arrays
// recorded when outreach/proposals were generated.
export async function getKnowledgeItemsWithUsage(): Promise<KnowledgeItemWithUsage[]> {
  const agencyId = await getCurrentAgencyId();
  const res = await pool.query(
    `SELECT
      ki.id, ki.title, ki.category, ki.status, ki.applicable_agents, ki.updated_at,
      count(DISTINCT o.id)::int AS outreach_count,
      count(DISTINCT p.id)::int AS proposal_count,
      count(DISTINCT o.id) FILTER (WHERE o.status = 'sent')::int AS outreach_sent_count,
      count(DISTINCT o.id) FILTER (WHERE o.replied)::int AS outreach_replied_count,
      greatest(max(o.created_at), max(p.created_at)) AS last_used_at
    FROM knowledge_items ki
    LEFT JOIN outreach o ON ki.id = ANY(o.knowledge_ids)
    LEFT JOIN proposals p ON ki.id = ANY(p.knowledge_ids)
    WHERE ki.agency_id = $1
    GROUP BY ki.id
    ORDER BY (count(DISTINCT o.id) + count(DISTINCT p.id)) DESC, ki.updated_at DESC`,
    [agencyId]
  );

  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    status: r.status,
    applicable_agents: r.applicable_agents,
    updated_at: r.updated_at,
    usageCount: r.outreach_count + r.proposal_count,
    replyRate: r.outreach_sent_count > 0 ? Math.round((r.outreach_replied_count / r.outreach_sent_count) * 1000) / 10 : null,
    lastUsedAt: r.last_used_at,
  }));
}

export type KnowledgeCategoryStats = {
  category: string;
  itemCount: number;
  contentSizeKb: number;
  thisWeek: number;
  lastWeek: number;
  sparkline: number[]; // 7 entries, oldest to newest
};

// Real weekly usage per category, computed by unnesting the knowledge_ids
// recorded on outreach/proposals over the last 14 days and matching them
// back to the category each id belongs to — done in JS rather than a single
// gnarly SQL query, since volumes here are small (an internal dashboard).
export async function getKnowledgeCategoryStats(): Promise<KnowledgeCategoryStats[]> {
  const agencyId = await getCurrentAgencyId();
  const [items, outreachRows, proposalRows] = await Promise.all([
    pool.query(`SELECT id, category, length(content) AS len FROM knowledge_items WHERE agency_id = $1`, [agencyId]),
    pool.query(
      `SELECT o.knowledge_ids, o.created_at FROM outreach o JOIN leads l ON l.id = o.lead_id
       WHERE l.agency_id = $1 AND o.created_at > now() - interval '14 days' AND array_length(o.knowledge_ids, 1) > 0`,
      [agencyId]
    ),
    pool.query(
      `SELECT p.knowledge_ids, p.created_at FROM proposals p JOIN leads l ON l.id = p.lead_id
       WHERE l.agency_id = $1 AND p.created_at > now() - interval '14 days' AND array_length(p.knowledge_ids, 1) > 0`,
      [agencyId]
    ),
  ]);

  const categoryById = new Map<string, string>(items.rows.map((r) => [r.id, r.category]));
  const itemCountByCategory = new Map<string, number>();
  const sizeByCategory = new Map<string, number>();
  for (const row of items.rows) {
    itemCountByCategory.set(row.category, (itemCountByCategory.get(row.category) ?? 0) + 1);
    sizeByCategory.set(row.category, (sizeByCategory.get(row.category) ?? 0) + Number(row.len));
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const dailyByCategory = new Map<string, number[]>(); // index 0 = 13 days ago ... index 13 = today

  function bump(knowledgeIds: string[], createdAt: string) {
    const dayIndex = Math.floor((now - new Date(createdAt).getTime()) / dayMs);
    if (dayIndex < 0 || dayIndex > 13) return;
    const seen = new Set<string>();
    for (const id of knowledgeIds) {
      const category = categoryById.get(id);
      if (!category || seen.has(category)) continue;
      seen.add(category);
      const arr = dailyByCategory.get(category) ?? new Array(14).fill(0);
      // index 13 = today, so convert dayIndex (0 = today) to array position
      arr[13 - dayIndex] += 1;
      dailyByCategory.set(category, arr);
    }
  }

  for (const row of outreachRows.rows) bump(row.knowledge_ids, row.created_at);
  for (const row of proposalRows.rows) bump(row.knowledge_ids, row.created_at);

  return KNOWLEDGE_CATEGORIES.map((category) => {
    const daily = dailyByCategory.get(category) ?? new Array(14).fill(0);
    const lastWeek = daily.slice(0, 7).reduce((a, b) => a + b, 0);
    const thisWeek = daily.slice(7, 14).reduce((a, b) => a + b, 0);
    return {
      category,
      itemCount: itemCountByCategory.get(category) ?? 0,
      contentSizeKb: Math.round(((sizeByCategory.get(category) ?? 0) / 1024) * 10) / 10,
      thisWeek,
      lastWeek,
      sparkline: daily.slice(7, 14),
    };
  });
}

export type DateRange = { from?: string; to?: string };

export function dateClause(column: string, range: DateRange | undefined, params: unknown[]): string {
  if (!range) return "";
  const clauses: string[] = [];
  if (range.from) {
    params.push(range.from);
    clauses.push(`${column} >= $${params.length}`);
  }
  if (range.to) {
    params.push(`${range.to} 23:59:59`);
    clauses.push(`${column} <= $${params.length}`);
  }
  return clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
}

export async function getLeads(status?: string, range?: DateRange): Promise<Lead[]> {
  const agencyId = await getCurrentAgencyId();
  const params: unknown[] = [agencyId];
  let where = "";
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  where += dateClause("created_at", range, params);

  const res = await pool.query(
    `SELECT * FROM leads WHERE agency_id = $1${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return res.rows.map(normalizeLead);
}

export async function getDueActions(limit = 8): Promise<Lead[]> {
  const agencyId = await getCurrentAgencyId();
  const res = await pool.query(
    `SELECT * FROM leads
     WHERE agency_id = $1 AND next_action_due IS NOT NULL AND status != 'archived'
     ORDER BY next_action_due ASC LIMIT $2`,
    [agencyId, limit]
  );
  return res.rows.map(normalizeLead);
}

export async function getRecentQualifiedLeads(limit = 8): Promise<Lead[]> {
  const agencyId = await getCurrentAgencyId();
  const res = await pool.query(
    `SELECT * FROM leads WHERE agency_id = $1 AND score IS NOT NULL ORDER BY score DESC, created_at DESC LIMIT $2`,
    [agencyId, limit]
  );
  return res.rows.map(normalizeLead);
}

export async function getQualifiedLeadsFiltered(range?: DateRange): Promise<Lead[]> {
  const agencyId = await getCurrentAgencyId();
  const params: unknown[] = [agencyId];
  const where = dateClause("qualified_at", range, params);

  const res = await pool.query(
    `SELECT * FROM leads
     WHERE agency_id = $1 AND score IS NOT NULL AND status != 'archived'${where}
     ORDER BY score DESC, qualified_at DESC
     LIMIT 200`,
    params
  );
  return res.rows.map(normalizeLead);
}

export type ApiUsageRow = {
  provider: string;
  operation: string;
  unit: string;
  quantity: number;
};

export type ApiUsageSummary = {
  provider: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number | null;
};

export type DailyApiSpend = {
  day: string;
  estimatedCostUsd: number;
};

export async function getApiUsageSummary(
  range?: DateRange
): Promise<{ byProvider: ApiUsageSummary[]; daily: DailyApiSpend[] }> {
  const agencyId = await getCurrentAgencyId();
  const settings = await getSettings();

  const params: unknown[] = [agencyId];
  const where = dateClause("created_at", range, params);

  const rows = await pool.query<ApiUsageRow & { created_at: string }>(
    `SELECT provider, operation, unit, quantity, created_at FROM api_usage
     WHERE agency_id = $1${where}
     ORDER BY created_at ASC`,
    params
  );

  const rateFor = (provider: string, unit: string): number => {
    if (provider === "deepseek" && unit === "tokens_in") return settings.cost_rate_deepseek_input_per_1m / 1_000_000;
    if (provider === "deepseek" && unit === "tokens_out") return settings.cost_rate_deepseek_output_per_1m / 1_000_000;
    if (provider === "geoapify" && unit === "requests") return settings.cost_rate_geoapify_per_request;
    if (provider === "brave" && unit === "requests") return settings.cost_rate_brave_per_request;
    if (provider === "resend" && unit === "requests") return settings.cost_rate_resend_per_email;
    return 0;
  };

  const byProviderMap = new Map<string, ApiUsageSummary>();
  const dailyMap = new Map<string, number>();
  const configuredRateExists = new Map<string, boolean>();

  for (const row of rows.rows) {
    const existing = byProviderMap.get(row.provider) ?? {
      provider: row.provider,
      requests: 0,
      tokensIn: 0,
      tokensOut: 0,
      estimatedCostUsd: 0,
    };

    const rate = rateFor(row.provider, row.unit);
    if (rate > 0) configuredRateExists.set(row.provider, true);
    const cost = row.quantity * rate;

    if (row.unit === "requests") existing.requests += row.quantity;
    if (row.unit === "tokens_in") existing.tokensIn += row.quantity;
    if (row.unit === "tokens_out") existing.tokensOut += row.quantity;
    existing.estimatedCostUsd = (existing.estimatedCostUsd ?? 0) + cost;
    byProviderMap.set(row.provider, existing);

    const day = toISODateString(row.created_at) ?? String(row.created_at).slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + cost);
  }

  const byProvider = Array.from(byProviderMap.values()).map((p) => ({
    ...p,
    // Only show a $ figure once a real rate has been entered for this
    // provider — otherwise it's genuinely unknown, not zero.
    estimatedCostUsd: configuredRateExists.get(p.provider) ? p.estimatedCostUsd : null,
  }));

  const daily = Array.from(dailyMap.entries())
    .map(([day, estimatedCostUsd]) => ({ day, estimatedCostUsd }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return { byProvider, daily };
}

export type TelegramLink = {
  id: string;
  telegram_username: string | null;
  min_notification_level: string;
  linked_at: string;
};

export async function getTelegramLinkForUser(userId: string): Promise<TelegramLink | null> {
  const res = await pool.query(
    `SELECT id, telegram_username, min_notification_level, linked_at FROM telegram_links WHERE user_id = $1 AND active = true`,
    [userId]
  );
  return res.rows[0] ?? null;
}

export async function getOutreach(range?: DateRange): Promise<OutreachRow[]> {
  const agencyId = await getCurrentAgencyId();
  const params: unknown[] = [agencyId];
  const where = dateClause("o.created_at", range, params);

  const res = await pool.query(
    `SELECT o.*, l.business_name, l.email AS lead_email, l.phone AS lead_phone
     FROM outreach o JOIN leads l ON l.id = o.lead_id
     WHERE l.agency_id = $1${where}
     ORDER BY o.created_at DESC LIMIT 200`,
    params
  );
  return res.rows;
}

export async function getFollowUps(range?: DateRange): Promise<FollowUpRow[]> {
  const agencyId = await getCurrentAgencyId();
  const params: unknown[] = [agencyId];
  const where = dateClause("f.scheduled_at", range, params);

  const res = await pool.query(
    `SELECT f.*, l.business_name
     FROM follow_ups f JOIN leads l ON l.id = f.lead_id
     WHERE l.agency_id = $1${where}
     ORDER BY f.scheduled_at DESC LIMIT 200`,
    params
  );
  return res.rows;
}

export async function getProposals(range?: DateRange): Promise<ProposalRow[]> {
  const agencyId = await getCurrentAgencyId();
  const params: unknown[] = [agencyId];
  const where = dateClause("p.created_at", range, params);

  const res = await pool.query(
    `SELECT p.*, l.business_name, l.email AS lead_email
     FROM proposals p JOIN leads l ON l.id = p.lead_id
     WHERE l.agency_id = $1${where}
     ORDER BY p.created_at DESC LIMIT 100`,
    params
  );
  return res.rows;
}

export async function getSearchApiUsageThisMonth(provider: string): Promise<number> {
  const agencyId = await getCurrentAgencyId();
  const res = await pool.query(
    `SELECT count(*)::int AS n FROM search_api_usage
     WHERE agency_id = $1 AND provider = $2 AND used_at >= date_trunc('month', now())`,
    [agencyId, provider]
  );
  return res.rows[0].n;
}

export type BusinessContextRow = {
  id: string;
  agency_id: string;
  business_name: string | null;
  industry: string | null;
  business_model: string | null;
  products: string[];
  services: string[];
  pricing: string | null;
  location: string | null;
  target_markets: string[];
  icp: string | null;
  customer_segments: string[];
  acquisition_channels: string[];
  sales_channels: string[];
  website: string | null;
  social_media: Record<string, string>;
  communication_channels: string[];
  constraints: string | null;
  budget: string | null;
  goals: string | null;
  updated_at: string;
};

export async function getBusinessContextForDashboard(): Promise<BusinessContextRow | null> {
  const agencyId = await getCurrentAgencyId();
  const res = await pool.query(
    `SELECT * FROM business_context WHERE agency_id = $1`,
    [agencyId]
  );
  return res.rows[0] ?? null;
}
