import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ProposalModal } from "@/components/proposal-modal";
import { ProposalWizard } from "@/components/proposal-wizard";
import { Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { getKnowledgeRefs, getLeads, getProposals } from "@/lib/queries";
import { DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

const DEAL_STAGES = ["Qualified", "Proposal Sent", "Negotiating", "Won", "Lost"] as const;

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const [rows, leads] = await Promise.all([getProposals({ from, to }), getLeads()]);

  const eligibleLeads = leads
    .filter((l) => l.status !== "archived")
    .map((l) => ({ id: l.id, business_name: l.business_name }));

  // Group deals leads by pipeline_stage
  const dealLeads = leads.filter((l) => DEAL_STAGES.includes(l.pipeline_stage as typeof DEAL_STAGES[number]));

  const allKnowledgeIds = [...new Set(rows.flatMap((r) => r.knowledge_ids))];
  const knowledgeRefs = await getKnowledgeRefs(allKnowledgeIds);
  const refsById = new Map(knowledgeRefs.map((r) => [r.id, r]));

  const wonRevenue = dealLeads
    .filter((l) => l.pipeline_stage === "Won")
    .reduce((sum, l) => sum + (Number((l as unknown as { deal_value?: number }).deal_value) || 0), 0);

  return (
    <AppShell>
      <section className="p-4 sm:p-6 min-h-screen" style={{ background: "var(--app-bg)" }}>

        <PageHeader
          title="Deals"
          subtitle="Proposals and pipeline deals across all stages."
          actions={<ProposalWizard leads={eligibleLeads} />}
        />

        {/* Pipeline stage summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {DEAL_STAGES.map((stage) => {
            const count = dealLeads.filter((l) => l.pipeline_stage === stage).length;
            const isWon = stage === "Won";
            const isLost = stage === "Lost";
            return (
              <div
                key={stage}
                className="rounded-xl p-4 text-center"
                style={{
                  background: isWon
                    ? "rgba(34,197,94,0.08)"
                    : isLost
                      ? "rgba(239,68,68,0.06)"
                      : "var(--surface)",
                  border: isWon
                    ? "1px solid rgba(34,197,94,0.25)"
                    : isLost
                      ? "1px solid rgba(239,68,68,0.2)"
                      : "1px solid var(--border-c)",
                }}
              >
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{
                    color: isWon ? "rgb(34,197,94)" : isLost ? "rgb(239,68,68)" : "var(--ink)",
                  }}
                >
                  {count}
                </p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--ink-muted)" }}>
                  {stage}
                </p>
              </div>
            );
          })}
        </div>

        {wonRevenue > 0 && (
          <div
            className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <DollarSign size={16} style={{ color: "rgb(34,197,94)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              Won revenue:{" "}
              <span style={{ color: "rgb(34,197,94)" }}>
                {wonRevenue.toLocaleString()}
              </span>
            </p>
          </div>
        )}

        <div className="flex justify-end mb-4">
          <DateRangeFilter label="Created between" />
        </div>

        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              title="No proposals yet"
              hint='Click "New proposal" above to generate a tailored proposal for a lead.'
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border-c">
                  <tr>
                    <Th>Business</Th>
                    <Th>Services</Th>
                    <Th>Budget</Th>
                    <Th>Preview</Th>
                    <Th>Created</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="table-row-hover border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
                      <Td className="font-medium">
                        <Link href={`/opportunities/${row.lead_id}`} className="text-brand hover:underline">
                          {row.business_name}
                        </Link>
                      </Td>
                      <Td className="capitalize">{row.services?.join(", ") ?? "—"}</Td>
                      <Td className="capitalize">{row.budget_range ?? "—"}</Td>
                      <Td className="text-ink-secondary max-w-md truncate">{row.content ?? "—"}</Td>
                      <Td className="text-ink-muted">{formatDate(row.created_at)}</Td>
                      <Td>
                        <ProposalModal
                          row={row}
                          knowledgeRefs={row.knowledge_ids.map((id) => refsById.get(id)).filter((r) => r != null)}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </AppShell>
  );
}
