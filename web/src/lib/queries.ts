import { readFile } from "fs/promises";
import path from "path";
import pool from "./db";

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
  services: string[] | null;
  budget_range: string | null;
  content: string | null;
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

export type DateRange = { from?: string; to?: string };

function dateClause(column: string, range: DateRange | undefined, params: unknown[]): string {
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
    `SELECT p.*, l.business_name
     FROM proposals p JOIN leads l ON l.id = p.lead_id
     WHERE true${where}
     ORDER BY p.created_at DESC LIMIT 100`,
    params
  );
  return res.rows;
}
