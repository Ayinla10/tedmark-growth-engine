import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AgentRunButton } from "@/components/agent-run-button";
import { OutreachModal } from "@/components/outreach-modal";
import { Card, EmptyState, PageHeader, StatusBadge, Td, Th, formatDate } from "@/components/ui";
import { getOutreach } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const rows = await getOutreach();

  return (
    <AppShell>
      <section className="p-6">
        <PageHeader
          title="Outreach drafts"
          subtitle="Messages written by the Outreach agent."
          actions={
            <AgentRunButton
              label="Generate drafts (score ≥ 6)"
              runningLabel="Drafting…"
              variant="primary"
              action="outreach"
              limit={10}
            />
          }
        />

        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState title="No outreach yet" hint='Click "Generate drafts" above, or run: node index.js outreach --limit 10' />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border-c">
                  <tr>
                    <Th>Business</Th>
                    <Th>Channel</Th>
                    <Th>Subject</Th>
                    <Th>Preview</Th>
                    <Th>Status</Th>
                    <Th>Sent</Th>
                    <Th>Replied</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
                      <Td className="font-medium">
                        <Link href={`/leads/${row.lead_id}`} className="text-brand hover:underline">
                          {row.business_name}
                        </Link>
                      </Td>
                      <Td>
                        {row.message_type === "whatsapp" ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400">
                            WhatsApp
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-ink-secondary">
                            Email
                          </span>
                        )}
                      </Td>
                      <Td className="max-w-xs truncate">{row.subject ?? "—"}</Td>
                      <Td className="text-ink-secondary max-w-sm truncate">{row.body}</Td>
                      <Td><StatusBadge status={row.status} /></Td>
                      <Td className="text-ink-muted">{formatDate(row.sent_at)}</Td>
                      <Td>{row.replied ? "Yes" : "—"}</Td>
                      <Td><OutreachModal row={row} /></Td>
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
