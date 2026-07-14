import { readFile } from "fs/promises";
import path from "path";
import pool from "./db";
import { KNOWLEDGE_CATEGORIES } from "./knowledge-constants";

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
    lead: lead.rows[0] ?? null,
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
  social_url: string | null;
  discovery_evidence: DiscoveryEvidence | null;
  created_at: string;
};

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
  const [leads, outreach, proposals, followUps] = await Promise.all([
    pool.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE created_at::date = now()::date)::int AS today,
        count(*) FILTER (WHERE status = 'raw')::int AS raw,
        count(*) FILTER (WHERE status = 'qualified')::int AS qualified,
        count(*) FILTER (WHERE status = 'contacted')::int AS contacted,
        count(*) FILTER (WHERE status = 'archived')::int AS archived,
        round(avg(score) FILTER (WHERE score IS NOT NULL), 1)::float AS avg_score
      FROM leads
    `),
    pool.query(`
      SELECT
        count(*) FILTER (WHERE status = 'draft')::int AS drafts,
        count(*) FILTER (WHERE replied)::int AS replied
      FROM outreach
    `),
    pool.query(`SELECT count(*)::int AS total FROM proposals`),
    pool.query(`SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending FROM follow_ups`),
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
  const params: unknown[] = [];
  let where = "";
  if (search) {
    params.push(`%${search}%`);
    where = ` WHERE title ILIKE $1 OR content ILIKE $1 OR $1 = ANY(tags)`;
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
  const res = await pool.query(`SELECT * FROM signatures ORDER BY is_default DESC, created_at ASC`);
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
  const res = await pool.query(`
    SELECT
      ki.id, ki.title, ki.category, ki.status, ki.applicable_agents, ki.updated_at,
      count(DISTINCT o.id)::int AS outreach_count,
      count(DISTINCT p.id)::int AS proposal_count,
      count(DISTINCT o.id) FILTER (WHERE o.status = 'sent')::int AS outreach_sent_count,
      count(DISTINCT o.id) FILTER (WHERE o.replied)::int AS outreach_replied_count,
      greatest(max(o.created_at), max(p.created_at)) AS last_used_at
    FROM knowledge_items ki
    LEFT JOIN outreach o ON ki.id = ANY(o.knowledge_ids)
    LEFT JOIN proposals p ON ki.id = ANY(p.knowledge_ids)
    GROUP BY ki.id
    ORDER BY (count(DISTINCT o.id) + count(DISTINCT p.id)) DESC, ki.updated_at DESC
  `);

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
  const [items, outreachRows, proposalRows] = await Promise.all([
    pool.query(`SELECT id, category, length(content) AS len FROM knowledge_items`),
    pool.query(`SELECT knowledge_ids, created_at FROM outreach WHERE created_at > now() - interval '14 days' AND array_length(knowledge_ids, 1) > 0`),
    pool.query(`SELECT knowledge_ids, created_at FROM proposals WHERE created_at > now() - interval '14 days' AND array_length(knowledge_ids, 1) > 0`),
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
  const params: unknown[] = [];
  let where = "";
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  where += dateClause("created_at", range, params);

  const res = await pool.query(
    `SELECT * FROM leads WHERE true${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return res.rows;
}

export async function getRecentQualifiedLeads(limit = 8): Promise<Lead[]> {
  const res = await pool.query(
    `SELECT * FROM leads WHERE score IS NOT NULL ORDER BY score DESC, created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function getQualifiedLeadsFiltered(range?: DateRange): Promise<Lead[]> {
  const params: unknown[] = [];
  const where = dateClause("qualified_at", range, params);

  const res = await pool.query(
    `SELECT * FROM leads
     WHERE score IS NOT NULL AND status != 'archived'${where}
     ORDER BY score DESC, qualified_at DESC
     LIMIT 200`,
    params
  );
  return res.rows;
}

export async function getOutreach(range?: DateRange): Promise<OutreachRow[]> {
  const params: unknown[] = [];
  const where = dateClause("o.created_at", range, params);

  const res = await pool.query(
    `SELECT o.*, l.business_name, l.email AS lead_email, l.phone AS lead_phone
     FROM outreach o JOIN leads l ON l.id = o.lead_id
     WHERE true${where}
     ORDER BY o.created_at DESC LIMIT 200`,
    params
  );
  return res.rows;
}

export async function getFollowUps(range?: DateRange): Promise<FollowUpRow[]> {
  const params: unknown[] = [];
  const where = dateClause("f.scheduled_at", range, params);

  const res = await pool.query(
    `SELECT f.*, l.business_name
     FROM follow_ups f JOIN leads l ON l.id = f.lead_id
     WHERE true${where}
     ORDER BY f.scheduled_at DESC LIMIT 200`,
    params
  );
  return res.rows;
}

export async function getProposals(range?: DateRange): Promise<ProposalRow[]> {
  const params: unknown[] = [];
  const where = dateClause("p.created_at", range, params);

  const res = await pool.query(
    `SELECT p.*, l.business_name, l.email AS lead_email
     FROM proposals p JOIN leads l ON l.id = p.lead_id
     WHERE true${where}
     ORDER BY p.created_at DESC LIMIT 100`,
    params
  );
  return res.rows;
}

export async function getSearchApiUsageThisMonth(provider: string): Promise<number> {
  const res = await pool.query(
    `SELECT count(*)::int AS n FROM search_api_usage
     WHERE provider = $1 AND used_at >= date_trunc('month', now())`,
    [provider]
  );
  return res.rows[0].n;
}
