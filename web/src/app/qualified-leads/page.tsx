import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AgentRunButton } from "@/components/agent-run-button";
import { LeadRowActions } from "@/components/lead-row-actions";
import { ScoringProtocol } from "@/components/scoring-protocol";
import { Card, EmptyState, PageHeader, ScoreBadge, Td, Th, formatDate } from "@/components/ui";
import { getLeads, getScoringProtocol } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function QualifiedLeadsPage() {
  const [allLeads, protocol] = await Promise.all([getLeads(), getScoringProtocol()]);
  const leads = allLeads.filter((l) => l.score != null && l.status !== "archived");
  const sorted = [...leads].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
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
                    <Th>Qualified</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((lead) => (
                    <tr key={lead.id} className="border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
                      <Td className="font-medium">
                        <Link href={`/leads/${lead.id}`} className="text-brand hover:underline">
                          {lead.business_name}
                        </Link>
                      </Td>
                      <Td className="capitalize">{lead.sector ?? "—"}</Td>
                      <Td><ScoreBadge score={lead.score} /></Td>
                      <Td className="text-ink-secondary max-w-md">{lead.score_reason ?? "—"}</Td>
                      <Td className="text-ink-muted">{formatDate(lead.created_at)}</Td>
                      <Td>
                        <LeadRowActions
                          leadId={lead.id}
                          showQualify
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
