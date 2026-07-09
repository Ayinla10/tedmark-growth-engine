import { query } from '../tools/db.js';

// Real aggregate analysis over the pipeline's own data — sector
// performance, channel effectiveness, and funnel conversion — stored as a
// snapshot so the dashboard can show the Analytics agent's actual output
// instead of a presentation-only placeholder.

async function sectorPerformance() {
  const result = await query(`
    SELECT
      sector,
      count(*)::int AS total,
      round(avg(score) FILTER (WHERE score IS NOT NULL), 1)::float AS avg_score,
      count(*) FILTER (WHERE status = 'contacted')::int AS contacted
    FROM leads
    WHERE sector IS NOT NULL
    GROUP BY sector
    HAVING count(*) >= 3
    ORDER BY avg_score DESC NULLS LAST
  `);
  return result.rows;
}

async function channelPerformance() {
  const result = await query(`
    SELECT
      message_type,
      count(*)::int AS sent,
      count(*) FILTER (WHERE replied)::int AS replied
    FROM outreach
    WHERE status = 'sent'
    GROUP BY message_type
  `);
  return result.rows.map((r) => ({
    channel: r.message_type,
    sent: r.sent,
    replied: r.replied,
    replyRate: r.sent > 0 ? Math.round((r.replied / r.sent) * 1000) / 10 : null,
  }));
}

async function funnelConversion() {
  const result = await query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE status != 'raw')::int AS qualified_or_further,
      count(*) FILTER (WHERE status = 'contacted')::int AS contacted
    FROM leads
  `);
  const row = result.rows[0];
  return {
    totalLeads: row.total,
    qualifyRate: row.total > 0 ? Math.round((row.qualified_or_further / row.total) * 1000) / 10 : null,
    contactRate: row.qualified_or_further > 0 ? Math.round((row.contacted / row.qualified_or_further) * 1000) / 10 : null,
  };
}

export function buildSummary({ sectors, channels, funnel }) {
  const parts = [];

  if (sectors.length > 0) {
    const best = sectors[0];
    parts.push(`${best.sector} leads score highest so far (avg ${best.avg_score ?? '—'}/10 across ${best.total} leads).`);
  }

  const withReplies = channels.filter((c) => c.replyRate !== null && c.replyRate > 0);
  if (withReplies.length > 0) {
    const best = [...withReplies].sort((a, b) => b.replyRate - a.replyRate)[0];
    parts.push(`${best.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} is getting the best reply rate (${best.replyRate}%).`);
  } else if (channels.some((c) => c.sent > 0)) {
    parts.push('No replies logged yet on sent outreach.');
  }

  if (funnel.contactRate !== null) {
    parts.push(`${funnel.contactRate}% of qualified leads have been contacted so far.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Not enough data yet to surface meaningful trends.';
}

export async function runAnalytics() {
  const [sectors, channels, funnel] = await Promise.all([
    sectorPerformance(),
    channelPerformance(),
    funnelConversion(),
  ]);

  const insights = { sectors, channels, funnel };
  const summary = buildSummary({ sectors, channels, funnel });

  await query(
    `INSERT INTO analytics_snapshots (summary, insights) VALUES ($1, $2)`,
    [summary, JSON.stringify(insights)]
  );

  console.log(`[analytics] ${summary}`);
  return { summary, insights };
}
