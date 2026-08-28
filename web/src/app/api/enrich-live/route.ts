import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// Server-Sent Events endpoint — streams enrich_events for a given lead
// in real time. The enricher writes rows to enrich_events as it works;
// this route polls every 800ms and pushes new rows to the client.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) return new Response("Missing leadId", { status: 400 });

  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enrich_events (
      id         SERIAL PRIMARY KEY,
      lead_id    INTEGER NOT NULL,
      type       TEXT NOT NULL DEFAULT 'info',
      message    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const encoder = new TextEncoder();
  let lastId = 0;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial ping
      controller.enqueue(encoder.encode(`event: ping\ndata: connected\n\n`));

      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }

        try {
          const result = await pool.query(
            `SELECT * FROM enrich_events WHERE lead_id = $1 AND id > $2 ORDER BY id ASC`,
            [leadId, lastId]
          );

          for (const row of result.rows) {
            lastId = row.id;
            const payload = JSON.stringify({ type: row.type, message: row.message, at: row.created_at });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

            // Close stream when enrichment is done
            if (row.type === 'done') {
              clearInterval(interval);
              closed = true;
              controller.close();
              return;
            }
          }
        } catch {
          // db error — keep trying
        }
      }, 800);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
