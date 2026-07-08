import { History } from "lucide-react";
import { AgentRunButton } from "@/components/agent-run-button";
import { OutreachIcon, ProposalIcon, QualifierIcon, ScoutIcon, SequencerIcon } from "@/components/agent-icons";
import { AnimatedNumber } from "@/components/animated-number";
import { AppShell } from "@/components/app-shell";
import { MotionCard } from "@/components/motion-card";
import { RunScoutModal } from "@/components/run-scout-modal";
import { TerminalLog } from "@/components/terminal-log";
import {
  getAgentActivity,
  getFollowUps,
  getKpiSummary,
  getOutreach,
  getProposals,
  getRecentQualifiedLeads,
} from "@/lib/queries";
import { isRecent, timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

function StatusBadge({ active, activeLabel, idleLabel, color }: { active: boolean; activeLabel: string; idleLabel: string; color: string }) {
  return (
    <p className="text-xs flex items-center gap-1.5" style={{ color: active ? color : "var(--ink-muted)" }}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? "status-dot-active" : ""}`}
        style={{ background: active ? "#22c55e" : "var(--ink-muted)" }}
      />
      {active ? activeLabel : idleLabel}
    </p>
  );
}

export default async function AgentsPage() {
  const [kpi, topLeads, followUps, outreach, proposals, activity] = await Promise.all([
    getKpiSummary(),
    getRecentQualifiedLeads(1),
    getFollowUps(),
    getOutreach(),
    getProposals(),
    getAgentActivity(),
  ]);
  const topLead = topLeads[0] ?? null;
  const upcomingFollowUps = followUps.filter((f) => f.status === "pending").slice(0, 2);
  const latestDraft = outreach.find((o) => o.status === "draft") ?? null;
  const latestProposal = proposals[0] ?? null;

  const scoutActive = isRecent(activity.scoutLastRunAt);
  const qualifierActive = isRecent(activity.qualifierLastRunAt);
  const outreachActive = isRecent(activity.outreachLastDraftAt);
  const sequencerActive = isRecent(activity.sequencerLastRunAt);
  const proposalActive = isRecent(activity.proposalLastRunAt);
  const anyActive = scoutActive || qualifierActive || outreachActive || sequencerActive || proposalActive;

  return (
    <AppShell>
      <section className="flex-1 p-6 pb-64">
        <div className="hero-gradient rounded-3xl border border-border-c p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${anyActive ? "bg-green-500 animate-pulse" : "bg-ink-muted"}`} />
              <span className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
                {anyActive ? "Agents active in the last 24h" : "No recent activity"}
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-ink">Agent intelligence command</h2>
            <p className="text-ink-secondary">Real-time view of what each agent is actually doing.</p>
          </div>
          <div className="flex gap-3">
            <RunScoutModal />
            <AgentRunButton label="Run sequencer" runningLabel="Syncing…" variant="primary" action="sequence" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Scout */}
          <MotionCard index={0} className="glass rounded-3xl p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand/15 flex items-center justify-center text-brand border border-brand/30">
                  <ScoutIcon active={scoutActive} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Scout</h3>
                  <StatusBadge active={scoutActive} activeLabel={`Ran ${timeAgo(activity.scoutLastRunAt)}`} idleLabel="Idle" color="var(--brand)" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-ink-muted block">Raw leads</span>
                <AnimatedNumber value={kpi.funnel.raw} className="text-lg font-semibold text-brand" />
              </div>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Found today:</span>
                <span className="font-medium text-ink">{kpi.leadsToday} businesses</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Sector+city coverage:</span>
                <span className="font-medium text-ink">
                  {activity.scoutCombosTotal - activity.scoutCombosRemaining} of {activity.scoutCombosTotal} done
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Data source:</span>
                <span className="font-medium text-ai">Geoapify Places</span>
              </div>
            </div>
            <div className="flex items-center gap-6 pt-4 border-t border-border-c">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ink-muted uppercase">Pipeline coverage</span>
                  <span className="text-green-600 dark:text-green-400">
                    {kpi.leadsTotal > 0 ? Math.round(((kpi.leadsTotal - kpi.funnel.raw) / kpi.leadsTotal) * 100) : 0}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] transition-all duration-700"
                    style={{ width: `${kpi.leadsTotal > 0 ? ((kpi.leadsTotal - kpi.funnel.raw) / kpi.leadsTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-ink-muted block">Total found</span>
                <AnimatedNumber value={kpi.leadsTotal} className="text-lg font-semibold text-ink" />
              </div>
            </div>
          </MotionCard>

          {/* Qualifier */}
          <MotionCard index={1} className="glass rounded-3xl p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-ai/15 flex items-center justify-center text-ai border border-ai/30">
                  <QualifierIcon active={qualifierActive} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Qualifier</h3>
                  <StatusBadge active={qualifierActive} activeLabel={`Scored ${timeAgo(activity.qualifierLastRunAt)}`} idleLabel="Idle" color="var(--ai)" />
                </div>
              </div>
              <div className="relative w-14 h-14">
                <svg className="w-full h-full -rotate-90">
                  <circle className="text-surface-2" cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeWidth="4" />
                  <circle
                    className="text-ai"
                    cx="28"
                    cy="28"
                    fill="transparent"
                    r="24"
                    stroke="currentColor"
                    strokeDasharray="150"
                    strokeDashoffset={150 - ((kpi.avgScore ?? 0) / 10) * 150}
                    strokeWidth="4"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink">
                  {kpi.avgScore != null ? `${kpi.avgScore}/10` : "—"}
                </span>
              </div>
            </div>
            <div className="p-4 bg-surface-2/60 rounded-2xl border border-border-c mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-ink-muted">Top scored lead</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400">
                  {topLead ? `${topLead.score}/10` : "None yet"}
                </span>
              </div>
              <p className="text-sm font-semibold text-ink">{topLead?.business_name ?? "No qualified leads yet"}</p>
              <p className="text-xs text-ink-muted mt-1 line-clamp-2">
                {topLead?.score_reason ?? "Run: node index.js qualify --limit 10"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <span className="text-xs text-ink-muted block">Avg score</span>
                <span className="text-lg font-semibold text-green-600 dark:text-green-400">{kpi.avgScore ?? "—"}</span>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <span className="text-xs text-ink-muted block">Qualified</span>
                <AnimatedNumber value={kpi.qualified} className="text-lg font-semibold text-ink" />
              </div>
            </div>
          </MotionCard>

          {/* Outreach */}
          <MotionCard index={2} className="glass rounded-3xl p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <OutreachIcon active={outreachActive} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Outreach</h3>
                  <StatusBadge active={outreachActive} activeLabel={`Drafted ${timeAgo(activity.outreachLastDraftAt)}`} idleLabel="Idle" color="#d97706" />
                </div>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-xs text-ink-muted mb-2">Latest draft</p>
              {latestDraft ? (
                <p className="text-sm italic text-ink-secondary border-l-2 border-brand pl-3 line-clamp-4">
                  &quot;{latestDraft.body.slice(0, 180)}
                  {latestDraft.body.length > 180 ? "…" : ""}&quot;
                </p>
              ) : (
                <p className="text-sm text-ink-muted border-l-2 border-border-c pl-3">
                  No drafts yet — run: node index.js outreach --limit 10
                </p>
              )}
            </div>
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs text-ink-muted block">Drafts awaiting approval</span>
                <AnimatedNumber value={kpi.drafts} className="text-lg font-semibold text-ink" />
              </div>
              <div className="text-right">
                <span className="text-xs text-ink-muted block">Contacted</span>
                <AnimatedNumber value={kpi.contacted} className="text-lg font-semibold text-brand" />
              </div>
            </div>
          </MotionCard>

          {/* Sequencer */}
          <MotionCard index={3} className="glass rounded-3xl p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-ai/15 flex items-center justify-center text-ai border border-ai/30">
                  <SequencerIcon active={sequencerActive} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Sequencer</h3>
                  <StatusBadge active={sequencerActive} activeLabel={`Ran ${timeAgo(activity.sequencerLastRunAt)}`} idleLabel="Idle • on standby" color="var(--ai)" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-ink-muted block">Pending</span>
                <AnimatedNumber value={kpi.pendingFollowUps} className="text-lg font-semibold text-ink" />
              </div>
            </div>
            <div className="space-y-3">
              {upcomingFollowUps.length === 0 ? (
                <div className="p-3 bg-surface-2 rounded-xl">
                  <p className="text-sm text-ink-secondary">No follow-ups pending.</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Created automatically when sent outreach goes 3+ days without a reply.
                  </p>
                </div>
              ) : (
                upcomingFollowUps.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl">
                    <History size={18} className="text-ai" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">
                        Follow-up #{f.sequence_step}: {f.business_name}
                      </p>
                      <p className="text-xs text-ink-muted">
                        Scheduled {new Date(f.scheduled_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </MotionCard>

          {/* Proposal */}
          <MotionCard index={4} className="glass rounded-3xl p-6 relative overflow-hidden lg:col-span-2">
            <div className="flex h-full gap-6">
              <div className="w-1/3 flex flex-col justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <ProposalIcon active={proposalActive} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">Proposal</h3>
                    <StatusBadge active={proposalActive} activeLabel={`Made ${timeAgo(activity.proposalLastRunAt)}`} idleLabel="Standing by" color="#d97706" />
                  </div>
                </div>
                <div className="mt-6">
                  <span className="text-xs text-ink-muted block mb-1">Proposals generated</span>
                  <AnimatedNumber value={kpi.proposals} className="text-4xl font-bold text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="flex-1 bg-surface-2 rounded-2xl p-4 overflow-hidden relative min-h-[180px]">
                {latestProposal ? (
                  <div className="h-full flex flex-col justify-end">
                    <p className="text-xs text-ink-muted mb-1">Most recent generation</p>
                    <h4 className="text-base font-semibold text-ink">{latestProposal.business_name}</h4>
                    <p className="text-sm text-ink-secondary capitalize">
                      {latestProposal.services?.join(", ") ?? "Services TBD"} &bull; {latestProposal.budget_range ?? "budget TBD"}
                    </p>
                    <p className="text-xs text-ink-muted mt-2 line-clamp-2">{latestProposal.content?.slice(0, 160) ?? ""}</p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-sm text-ink-secondary">No proposals generated yet.</p>
                    <p className="text-xs text-ink-muted mt-1 font-mono">
                      node index.js proposal --lead-id &lt;uuid&gt; --services &quot;website,seo&quot; --budget &quot;mid&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          </MotionCard>
        </div>
      </section>

      <TerminalLog />
    </AppShell>
  );
}
