import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AgentRunButton } from "@/components/agent-run-button";
import { DateRangeFilter } from "@/components/date-range-filter";
import { LeadRowActions } from "@/components/lead-row-actions";
import { PipelineCell } from "@/components/pipeline-cell";
import { ScoringProtocol } from "@/components/scoring-protocol";
import { Card, EmptyState, PageHeader, ScoreBadge, Td, Th } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { getLeads, getQualifiedLeadsFiltered, getScoringProtocol } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function QualifiedLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const [sorted, allLeads, protocol] = await Promise.all([
    getQualifiedLeadsFiltered({ from, to }),
    getLeads(),
    getScoringProtocol(),
  ]);
  const rawCount = allLeads.filter((l) => l.status === "raw").length;

  return (
    <AppShell>
      <section className="p-6">
        <PageHeader
          title="Qualified leads"
          subtitle={`${sorted.length} scored leads, best opportunities first.`}
          actions={
            rawCount > 0 ? (
              <AgentRunButton
                label={`Qualify ${rawCount} raw leads`}
                runningLabel="Qualifying…"
                variant="primary"
                action="qualify"
                limit={rawCount}
              />
            ) : undefined
          }
        />

        <div className="flex justify-end mb-4">
          <DateRangeFilter label="Qualified between" />
        </div>

        <ScoringProtocol protocol={protocol} />

        <Card className="overflow-hidden">
          {sorted.length === 0 ? (
            <EmptyState title="No qualified leads yet" hint="Run: node index.js qualify --limit 10" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border-c">
                  <tr>
                    <Th>Business</Th>
                    <Th>Sector</Th>
                    <Th>Score</Th>
                    <Th>Why this score</Th>
                    <Th>Pipeline</Th>
                    <Th>Qualified</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((lead) => (
                    <tr key={lead.id} className="table-row-hover border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
                      <Td className="font-medium">
                        <Link href={`/leads/${lead.id}`} className="text-brand hover:underline">
                          {lead.business_name}
                        </Link>
                      </Td>
                      <Td className="capitalize">{lead.sector ?? "—"}</Td>
                      <Td><ScoreBadge score={lead.score} /></Td>
                      <Td className="text-ink-secondary max-w-md">{lead.score_reason ?? "—"}</Td>
                      <Td>
                        <PipelineCell
                          leadId={lead.id}
                          pipelineStage={lead.pipeline_stage}
                          nextAction={lead.next_action}
                          nextActionDue={lead.next_action_due}
                        />
                      </Td>
                      <Td className="text-ink-muted">{formatDate(lead.created_at)}</Td>
                      <Td>
                        <LeadRowActions
                          leadId={lead.id}
                          showQualify
                          showDmEnrich
                          showGenerateOutreach={(lead.score ?? 0) >= 6}
                          showArchive
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
