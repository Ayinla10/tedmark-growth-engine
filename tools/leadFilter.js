/**
 * Shared lead filter builder.
 * Converts natural-language-extracted args into SQL WHERE fragments.
 * All agents import this to support context-aware filtering.
 *
 * Supported args:
 *   sector    — "clinic", "restaurant", etc. (ILIKE match on leads.sector)
 *   city      — "Accra", "Kumasi" (ILIKE match on leads.location)
 *   since     — "today", "yesterday", "this week", or ISO date string
 *   lead_ids  — comma-separated UUIDs (exact match)
 *   score_min — minimum qualify score (for outreach filtering)
 */

function resolveSince(since) {
  if (!since) return null;
  const d = new Date();
  const s = since.toString().toLowerCase().trim();
  if (s === 'today') {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (s === 'yesterday') {
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (s === 'this week') {
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (s === 'last week') {
    d.setDate(d.getDate() - d.getDay() - 7);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const parsed = new Date(since);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Build a SQL WHERE fragment and params array for lead filtering.
 *
 * @param {object} args - filter args from the conversation engine
 * @param {string} agencyId - always required
 * @param {number} [startIndex=2] - param index to start from (after $1 = agencyId)
 * @returns {{ conditions: string, params: any[], nextIndex: number }}
 *
 * Usage:
 *   const { conditions, params, nextIndex } = buildLeadFilter(args, agencyId);
 *   const sql = `SELECT * FROM leads WHERE agency_id = $1 ${conditions} LIMIT $${nextIndex}`;
 *   await query(sql, [...params, limit]);
 */
export function buildLeadFilter(args = {}, agencyId, startIndex = 2) {
  const conditions = [];
  const params = [agencyId]; // $1 is always agencyId
  let i = startIndex;

  if (args.sector) {
    conditions.push(`AND sector ILIKE $${i}`);
    params.push(`%${args.sector}%`);
    i++;
  }

  if (args.city) {
    conditions.push(`AND location ILIKE $${i}`);
    params.push(`%${args.city}%`);
    i++;
  }

  if (args.since) {
    const ts = resolveSince(args.since);
    if (ts) {
      conditions.push(`AND created_at >= $${i}`);
      params.push(ts);
      i++;
    }
  }

  if (args.lead_ids) {
    const ids = args.lead_ids.toString().split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) {
      conditions.push(`AND id = ANY($${i}::uuid[])`);
      params.push(ids);
      i++;
    }
  }

  if (args.score_min != null && !isNaN(Number(args.score_min))) {
    conditions.push(`AND score >= $${i}`);
    params.push(Number(args.score_min));
    i++;
  }

  return {
    conditions: conditions.join(' '),
    params,
    nextIndex: i,
  };
}
