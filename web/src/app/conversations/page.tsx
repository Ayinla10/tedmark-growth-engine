import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DateRangeFilter } from "@/components/date-range-filter";
import { OutreachModal } from "@/components/outreach-modal";
import { OutreachGeneratePanel } from "@/components/outreach-generate-panel";
import { Card, EmptyState, PageHeader, StatusBadge, Td, Th } from "@/components/ui";
import { AgentRunButton } from "@/components/agent-run-button";
import { formatDate } from "@/lib/time";
import { getKnowledgeRefs, getOutreach, getFollowUps, getSignatures } from "@/lib/queries";
import { MessageSquare, History } from "lucide-react";

export const dynamic = "force-dynamic";

type Tab = "all" | "outreach" | "follow-ups";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}) {
  const { from, to, tab } = await searchParams;
  const activeTab: Tab = (tab as Tab) || "all";

  const [outreachRows, followUpRows, signatures] = await Promise.all([
    getOutreach({ from, to }),
    getFollowUps({ from, to }),
    getSignatures(),
  ]);

  const allKnowledgeIds = [...new Set(outreachRows.flatMap((r) => r.knowledge_ids))];
  const knowledgeRefs = await getKnowledgeRefs(allKnowledgeIds);
  const refsById = new Map(knowledgeRefs.map((r) => [r.id, r]));

  // "Needs attention" = drafts awaiting approval or follow-ups pending
  const draftsCount = outreachRows.filter((r) => r.status === "draft").length;
  const pendingFollowUps = followUpRows.filter((f) => f.status === "pending").length;
  const needsAttentionCount = draftsCount + pendingFollowUps;

  const TABS = [
    { id: "all", label: "All messages" },
    { id: "outreach", label: `Outreach${outreachRows.length > 0 ? ` (${outreachRows.length})` : ""}` },
    { id: "follow-ups", label: `Follow-ups${followUpRows.length > 0 ? ` (${followUpRows.length})` : ""}` },
  ];

  const showOutreach = activeTab === "all" || activeTab === "outreach";
  const showFollowUps = activeTab === "all" || activeTab === "follow-ups";

  return (
    <AppShell>
      <section className="p-4 sm:p-6 min-h-screen" style={{ background: "var(--app-bg)" }}>

        <PageHeader
          title="Conversations"
          subtitle="Outreach messages, replies, and follow-up sequences."
          actions={<OutreachGeneratePanel signatures={signatures} />}
        />

        {/* Attention banner */}
        {needsAttentionCount > 0 && (
          <div
            className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3 text-sm"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}
          >
            <span className="text-amber-500 font-semibold">{needsAttentionCount} item{needsAttentionCount !== 1 ? "s" : ""} need attention:</span>
            {draftsCount > 0 && <span style={{ color: "var(--ink-secondary)" }}>{draftsCount} draft{draftsCount !== 1 ? "s" : ""} awaiting approval</span>}
            {pendingFollowUps > 0 && <span style={{ color: "var(--ink-secondary)" }}>{pendingFollowUps} follow-up{pendingFollowUps !== 1 ? "s" : ""} pending</span>}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => {
            const isActive = t.id === activeTab;
            return (
              <Link
                key={t.id}
                href={`/conversations?tab=${t.id}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  background: isActive ? "var(--brand)" : "var(--surface)",
                  color: isActive ? "#fff" : "var(--ink-muted)",
                  border: isActive ? "none" : "1px solid var(--border-c)",
                }}
              >
                {t.label}
              </Link>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <DateRangeFilter label="Date range" />
          </div>
        </div>

        {/* Outreach section */}
        {showOutreach && (
          <div className="mb-6">
            {activeTab === "all" && (
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={15} style={{ color: "var(--brand)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  Outreach messages
                </p>
              </div>
            )}
            <Card className="overflow-hidden">
              {outreachRows.length === 0 ? (
                <EmptyState
                  title="No outreach messages yet"
                  hint='Click "Generate drafts" above to have the AI draft personalised messages.'
                />
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
                      {outreachRows.map((row) => (
                        <tr key={row.id} className="table-row-hover border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
                          <Td className="font-medium">
                            <Link href={`/opportunities/${row.lead_id}`} className="text-brand hover:underline">
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
                          <Td>
                            <OutreachModal
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
          </div>
        )}

        {/* Follow-ups section */}
        {showFollowUps && (
          <div>
            {activeTab === "all" && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History size={15} style={{ color: "var(--brand)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    Follow-ups
                  </p>
                </div>
                <AgentRunButton
                  label="Check follow-ups"
                  runningLabel="Checking…"
                  variant="secondary"
                  action="sequence"
                />
              </div>
            )}
            <Card className="overflow-hidden">
              {followUpRows.length === 0 ? (
                <EmptyState
                  title="No follow-ups scheduled"
                  hint="AI schedules follow-up messages when sent outreach goes 3+ days without a reply."
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
                      {followUpRows.map((row) => (
                        <tr key={row.id} className="table-row-hover border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
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
          </div>
        )}
      </section>
    </AppShell>
  );
}
