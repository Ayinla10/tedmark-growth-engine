import { AppShell } from "@/components/app-shell";
import { Card, KpiCard, PageHeader } from "@/components/ui";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [bySector, scoreDist, summary] = await Promise.all([
    pool.query(`
      SELECT sector, count(*)::int AS total
      FROM leads GROUP BY sector ORDER BY total DESC LIMIT 10
    `),
    pool.query(`
      SELECT
        count(*) FILTER (WHERE score >= 8)::int AS high,
        count(*) FILTER (WHERE score BETWEEN 5 AND 7)::int AS mid,
        count(*) FILTER (WHERE score <= 4)::int AS low
      FROM leads WHERE score IS NOT NULL
    `),
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM leads) AS leads,
        (SELECT count(*)::int FROM outreach WHERE status = 'sent') AS sent,
        (SELECT count(*)::int FROM outreach WHERE replied) AS replied,
        (SELECT count(*)::int FROM proposals) AS proposals
    `),
  ]);

  const s = summary.rows[0];
  const d = scoreDist.rows[0];
  const responseRate = s.sent > 0 ? `${Math.round((s.replied / s.sent) * 100)}%` : "—";
  const sectorMax = Math.max(...bySector.rows.map((r) => r.total), 1);

  return (
    <AppShell>
      <section className="p-6">
        <PageHeader title="Analytics" subtitle="Pipeline performance across all agents." />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Total leads" value={s.leads} />
          <KpiCard label="Emails sent" value={s.sent} />
          <KpiCard label="Response rate" value={responseRate} />
          <KpiCard label="Proposals" value={s.proposals} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink mb-4">Leads by sector</p>
            {bySector.rows.length === 0 ? (
              <p className="text-sm text-ink-muted">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {bySector.rows.map((row) => (
                  <div key={row.sector ?? "unknown"}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-secondary capitalize">{row.sector ?? "Unknown"}</span>
                      <span className="font-semibold text-ink">{row.total}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(row.total / sectorMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink mb-4">AI score distribution</p>
            <div className="space-y-3">
              {[
                { label: "High need (8–10)", value: d.high, color: "bg-green-500" },
                { label: "Medium need (5–7)", value: d.mid, color: "bg-amber-500" },
                { label: "Low need (1–4)", value: d.low, color: "bg-red-500" },
              ].map((row) => {
                const total = Math.max(d.high + d.mid + d.low, 1);
                return (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-secondary">{row.label}</span>
                      <span className="font-semibold text-ink">{row.value}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.value / total) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {d.high + d.mid + d.low === 0 ? (
                <p className="text-sm text-ink-muted">No scored leads yet — run the qualifier.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
