import { AppShell } from "@/components/app-shell";
import { Card, EmptyState, KpiCard, PageHeader, ScoreBadge, StatusBadge, Td, Th, formatDate } from "@/components/ui";
import { getKpiSummary, getRecentQualifiedLeads } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [kpi, recent] = await Promise.all([getKpiSummary(), getRecentQualifiedLeads()]);

  const funnelMax = Math.max(kpi.funnel.raw + kpi.funnel.qualified + kpi.funnel.contacted, 1);
  const funnel = [
    { label: "Raw leads", value: kpi.funnel.raw, color: "bg-brand/40" },
    { label: "Qualified", value: kpi.funnel.qualified, color: "bg-brand/70" },
    { label: "Contacted", value: kpi.funnel.contacted, color: "bg-brand" },
    { label: "Archived", value: kpi.funnel.archived, color: "bg-surface-2" },
  ];

  return (
    <AppShell>
      <section className="p-6">
        <PageHeader
          title="Dashboard"
          subtitle="Your AI sales team is discovering and qualifying businesses across Ghana."
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <KpiCard label="Businesses found" value={kpi.leadsTotal} hint={`+${kpi.leadsToday} today`} />
          <KpiCard label="Qualified leads" value={kpi.qualified} hint={kpi.avgScore != null ? `Avg score ${kpi.avgScore}/10` : "No scores yet"} />
          <KpiCard label="Draft outreach" value={kpi.drafts} hint="Awaiting approval" />
          <KpiCard label="Contacted" value={kpi.contacted} />
          <KpiCard label="Replies" value={kpi.replied} />
          <KpiCard label="Proposals" value={kpi.proposals} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-5 lg:col-span-1">
            <p className="text-sm font-semibold text-ink mb-4">Lead funnel</p>
            <div className="space-y-3">
              {funnel.map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-secondary">{row.label}</span>
                    <span className="font-semibold text-ink">{row.value}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.color}`}
                      style={{ width: `${Math.max((row.value / funnelMax) * 100, row.value > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-muted mt-4">{kpi.pendingFollowUps} follow-ups pending</p>
          </Card>

          <Card className="lg:col-span-2 overflow-hidden">
            <div className="px-5 py-4 border-b border-border-c">
              <p className="text-sm font-semibold text-ink">Top qualified leads</p>
            </div>
            {recent.length === 0 ? (
              <EmptyState title="No qualified leads yet" hint="Run the qualifier: node index.js qualify --limit 10" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border-c">
                    <tr>
                      <Th>Business</Th>
                      <Th>Sector</Th>
                      <Th>Website</Th>
                      <Th>Score</Th>
                      <Th>Status</Th>
                      <Th>Found</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((lead) => (
                      <tr key={lead.id} className="border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
                        <Td className="font-medium">{lead.business_name}</Td>
                        <Td className="capitalize">{lead.sector ?? "—"}</Td>
                        <Td>{lead.website_url ? "Yes" : "No website"}</Td>
                        <Td><ScoreBadge score={lead.score} /></Td>
                        <Td><StatusBadge status={lead.status} /></Td>
                        <Td className="text-ink-muted">{formatDate(lead.created_at)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
