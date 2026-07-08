import { AppShell } from "@/components/app-shell";
import { AgentRunButton } from "@/components/agent-run-button";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Card, EmptyState, PageHeader, StatusBadge, Td, Th, formatDate } from "@/components/ui";
import { getFollowUps } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const rows = await getFollowUps({ from, to });

  return (
    <AppShell>
      <section className="p-6">
        <PageHeader
          title="Follow-ups"
          subtitle="Sequenced follow-ups scheduled by the Sequencer agent (max 3 steps per lead)."
          actions={
            <AgentRunButton
              label="Run sequencer now"
              runningLabel="Checking…"
              variant="primary"
              action="sequence"
            />
          }
        />

        <div className="flex justify-end mb-4">
          <DateRangeFilter label="Scheduled between" />
        </div>

        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              title="No follow-ups scheduled"
              hint="The sequencer creates these when sent outreach goes 3+ days without a reply."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border-c">
                  <tr>
                    <Th>Business</Th>
                    <Th>Step</Th>
                    <Th>Scheduled</Th>
                    <Th>Sent</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
                      <Td className="font-medium">{row.business_name}</Td>
                      <Td>{row.sequence_step} of 3</Td>
                      <Td className="text-ink-muted">{formatDate(row.scheduled_at)}</Td>
                      <Td className="text-ink-muted">{formatDate(row.sent_at)}</Td>
                      <Td><StatusBadge status={row.status} /></Td>
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
