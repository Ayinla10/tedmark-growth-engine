import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AnimatedBar } from "@/components/animated-bar";
import { Card, EmptyState, KpiCard, PageHeader, ScoreBadge, StatusBadge, Td, Th } from "@/components/ui";
import { getDueActions, getKpiSummary, getRecentQualifiedLeads } from "@/lib/queries";
import { formatDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [kpi, recent, dueActions] = await Promise.all([
    getKpiSummary(),
    getRecentQualifiedLeads(),
    getDueActions(),
  ]);
  const today = new Date().toISOString().slice(0, 10);

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
          <KpiCard index={0} label="Businesses found" value={kpi.leadsTotal} hint={`+${kpi.leadsToday} today`} />
          <KpiCard index={1} label="Qualified leads" value={kpi.qualified} hint={kpi.avgScore != null ? `Avg score ${kpi.avgScore}/10` : "No scores yet"} />
          <KpiCard index={2} label="Draft outreach" value={kpi.drafts} hint="Awaiting approval" />
          <KpiCard index={3} label="Contacted" value={kpi.contacted} />
          <KpiCard index={4} label="Replies" value={kpi.replied} />
          <KpiCard index={5} label="Proposals" value={kpi.proposals} />
        </div>

        {dueActions.length > 0 && (
          <Card index={5} className="p-5 mb-8">
            <p className="text-sm font-semibold text-ink mb-3">Next actions due</p>
            <div className="space-y-2">
              {dueActions.map((lead) => {
                const overdue = (lead.next_action_due ?? "") < today;
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between text-sm px-3 py-2 rounded-md hover:bg-surface-2/50"
                  >
                    <span className="text-ink">{lead.business_name}</span>
                    <span className="text-ink-secondary">{lead.next_action}</span>
                    <span className={overdue ? "text-red-400 font-medium" : "text-ink-muted"}>
                      {lead.next_action_due}
                      {overdue ? " (overdue)" : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card index={6} className="p-5 lg:col-span-1">
            <p className="text-sm font-semibold text-ink mb-4">Lead funnel</p>
            <div className="space-y-3">
              {funnel.map((row, i) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-secondary">{row.label}</span>
                    <span className="font-semibold text-ink">{row.value}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
                    <AnimatedBar
                      widthPercent={Math.max((row.value / funnelMax) * 100, row.value > 0 ? 4 : 0)}
                      className={row.color}
                      delay={0.1 + i * 0.08}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-muted mt-4">{kpi.pendingFollowUps} follow-ups pending</p>
          </Card>

          <Card index={7} className="lg:col-span-2 overflow-hidden">
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
                      <tr key={lead.id} className="table-row-hover border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
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
