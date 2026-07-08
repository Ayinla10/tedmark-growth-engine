import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await pool.query(`
    SELECT * FROM (
      SELECT
        l.created_at AS at,
        'SCOUT' AS agent,
        'Discovered "' || l.business_name || '" (' || coalesce(l.sector, 'unknown sector') || ')' AS message
      FROM leads l
      UNION ALL
      SELECT
        l.created_at AS at,
        'QUALIFIER' AS agent,
        'Scored "' || l.business_name || '" ' || l.score || '/10 — ' || coalesce(l.score_reason, '') AS message
      FROM leads l
      WHERE l.score IS NOT NULL
      UNION ALL
      SELECT
        o.created_at AS at,
        'OUTREACH' AS agent,
        'Draft created for lead: "' || coalesce(o.subject, 'no subject') || '"' AS message
      FROM outreach o
      UNION ALL
      SELECT
        o.sent_at AS at,
        'OUTREACH' AS agent,
        'Email sent: "' || coalesce(o.subject, 'no subject') || '"' AS message
      FROM outreach o
      WHERE o.sent_at IS NOT NULL
      UNION ALL
      SELECT
        f.scheduled_at AS at,
        'SEQUENCER' AS agent,
        'Follow-up step ' || f.sequence_step || ' scheduled (' || f.status || ')' AS message
      FROM follow_ups f
      UNION ALL
      SELECT
        p.created_at AS at,
        'PROPOSAL' AS agent,
        'Proposal generated (' || coalesce(array_to_string(p.services, ', '), 'services tbd') || ')' AS message
      FROM proposals p
    ) events
    WHERE at IS NOT NULL
    ORDER BY at DESC
    LIMIT 50
  `);

  return NextResponse.json({ events: result.rows });
}
