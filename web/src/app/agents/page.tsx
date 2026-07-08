import { FileText, RefreshCw, Send, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { AgentRunButton } from "@/components/agent-run-button";
import { AiCoreViz } from "@/components/ai-core-viz";
import { AnimatedNumber } from "@/components/animated-number";
import { CommandShell } from "@/components/command-shell";
import { Waveform } from "@/components/jarvis-core";
import { MotionCard } from "@/components/motion-card";
import { OrchestrationCanvas, type OrchestrationNode } from "@/components/orchestration-canvas";
import { RunScoutModal } from "@/components/run-scout-modal";
import { TerminalLog } from "@/components/terminal-log";
import {
  getAgentActivity,
  getFollowUps,
  getGrowthStats,
  getKpiSummary,
  getOutreach,
  getProposals,
  getRecentQualifiedLeads,
} from "@/lib/queries";
import { isRecent, timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

const AGENT_COLORS = {
  scout: "#38bdf8",
  qualifier: "#a78bfa",
  outreach: "#fbbf24",
  sequencer: "#818cf8",
  proposal: "#f59e0b",
  analytics: "#34d399",
} as const;

function pctChange(now: number, before: number): number | null {
  if (before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

export default async function AgentsPage() {
  const [kpi, topLeads, followUps, outreach, proposals, activity, growth] = await Promise.all([
    getKpiSummary(),
    getRecentQualifiedLeads(1),
    getFollowUps(),
    getOutreach(),
    getProposals(),
    getAgentActivity(),
    getGrowthStats(),
  ]);
  const topLead = topLeads[0] ?? null;
  const latestDraft = outreach.find((o) => o.status === "draft") ?? null;
  const latestProposal = proposals[0] ?? null;
  const pendingFollowUps = followUps.filter((f) => f.status === "pending").length;

  // Status per agent from real timestamps: most recently active agent is
  // "in progress", other recently-active are "completed", stale = "pending".
  const timestamps = [
    { key: "scout", at: activity.scoutLastRunAt },
    { key: "qualifier", at: activity.qualifierLastRunAt },
    { key: "outreach", at: activity.outreachLastDraftAt },
    { key: "sequencer", at: activity.sequencerLastRunAt },
    { key: "proposal", at: activity.proposalLastRunAt },
  ] as const;
  const recentKeys = timestamps.filter((t) => isRecent(t.at)).map((t) => t.key);
  const mostRecent = [...timestamps]
    .filter((t) => isRecent(t.at))
    .sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime())[0]?.key;

  function statusOf(key: (typeof timestamps)[number]["key"]): OrchestrationNode["status"] {
    if (key === mostRecent) return "inprogress";
    if (recentKeys.includes(key)) return "completed";
    return "pending";
  }
  function labelOf(key: (typeof timestamps)[number]["key"], at: string | null): string {
    const s = statusOf(key);
    if (s === "inprogress") return `Active ${timeAgo(at)}`;
    if (s === "completed") return `Completed ${timeAgo(at)}`;
    return "Pending";
  }

  const anyAgentActive = recentKeys.length > 0;

  const nodes: OrchestrationNode[] = [
    {
      variant: "scout",
      name: "Scout Agent",
      color: AGENT_COLORS.scout,
      status: statusOf("scout"),
      statusLabel: labelOf("scout", activity.scoutLastRunAt),
      detail: `Found ${kpi.leadsToday} businesses today`,
      order: 1,
    },
    {
      variant: "qualifier",
      name: "Qualifier Agent",
      color: AGENT_COLORS.qualifier,
      status: statusOf("qualifier"),
      statusLabel: labelOf("qualifier", activity.qualifierLastRunAt),
      detail: topLead ? `Top lead: ${topLead.business_name} (${topLead.score}/10)` : "Awaiting raw leads",
      order: 2,
    },
    {
      variant: "outreach",
      name: "Outreach Agent",
      color: AGENT_COLORS.outreach,
      status: statusOf("outreach"),
      statusLabel: labelOf("outreach", activity.outreachLastDraftAt),
      detail: kpi.drafts > 0 ? `${kpi.drafts} drafts awaiting approval` : "No drafts pending",
      order: 3,
    },
    {
      variant: "sequencer",
      name: "Sequencer Agent",
      color: AGENT_COLORS.sequencer,
      status: statusOf("sequencer"),
      statusLabel: labelOf("sequencer", activity.sequencerLastRunAt),
      detail: pendingFollowUps > 0 ? `${pendingFollowUps} follow-ups scheduled` : "Waiting on sent outreach",
      order: 4,
    },
    {
      variant: "proposal",
      name: "Proposal Agent",
      color: AGENT_COLORS.proposal,
      status: statusOf("proposal"),
      statusLabel: labelOf("proposal", activity.proposalLastRunAt),
      detail: latestProposal ? `Latest: ${latestProposal.business_name}` : "Awaiting qualified leads",
      order: 5,
    },
    {
      // Analytics reflects the pipeline as a whole: it "analyzes" whenever
      // any other agent has produced fresh data in the last 24h.
      variant: "analytics",
      name: "Analytics Agent",
      color: AGENT_COLORS.analytics,
      status: anyAgentActive ? "completed" : "pending",
      statusLabel: anyAgentActive ? "Analyzing" : "Pending",
      detail: `Tracking ${kpi.leadsTotal} leads & ${kpi.proposals} proposals`,
      order: 6,
    },
  ];

  const completedCount = nodes.filter((n) => n.status === "completed").length;
  const activeCount = nodes.filter((n) => n.status === "inprogress").length;
  const pendingCount = nodes.filter((n) => n.status === "pending").length;

  const currentActivity = [
    { node: nodes[0], line: `Discovered ${kpi.leadsToday} businesses using Geoapify Places`, at: activity.scoutLastRunAt },
    { node: nodes[1], line: topLead ? `Scored ${topLead.business_name}: ${topLead.score}/10` : "No leads scored yet", at: activity.qualifierLastRunAt },
    { node: nodes[2], line: latestDraft ? `Drafted ${latestDraft.message_type === "whatsapp" ? "WhatsApp message" : "email"} for ${latestDraft.business_name}` : "No drafts yet", at: activity.outreachLastDraftAt },
    { node: nodes[3], line: pendingFollowUps > 0 ? `${pendingFollowUps} follow-ups pending` : "Waiting for outreach to age 3+ days", at: activity.sequencerLastRunAt },
    { node: nodes[4], line: latestProposal ? `Generated proposal for ${latestProposal.business_name}` : "Awaiting qualified leads", at: activity.proposalLastRunAt },
    { node: nodes[5], line: "Processing data & insights", at: null },
  ];

  const conversionRate = kpi.qualified > 0 ? Math.round((kpi.contacted / kpi.qualified) * 1000) / 10 : null;

  const kpiCards = [
    { label: "Leads Discovered", sub: "Today", value: growth.leadsToday, delta: pctChange(growth.leadsToday, growth.leadsYesterday), deltaSub: "vs yesterday", icon: Users, color: "#38bdf8" },
    { label: "Qualified Leads", sub: "Today", value: growth.qualifiedToday, delta: pctChange(growth.qualifiedToday, growth.qualifiedYesterday), deltaSub: "vs yesterday", icon: ShieldCheck, color: "#a78bfa" },
    { label: "Outreach Sent", sub: "Today", value: growth.outreachSentToday, delta: pctChange(growth.outreachSentToday, growth.outreachSentYesterday), deltaSub: "vs yesterday", icon: Send, color: "#fbbf24" },
    { label: "Proposals Generated", sub: "This Week", value: growth.proposalsThisWeek, delta: pctChange(growth.proposalsThisWeek, growth.proposalsLastWeek), deltaSub: "vs last week", icon: FileText, color: "#f59e0b" },
  ];

  return (
    <CommandShell>
      <section className="p-6 pb-64 space-y-6">
        {/* Command header */}
        <div className="rounded-3xl border border-emerald-500/15 bg-[#080d1a] p-6 flex items-center justify-between flex-wrap gap-4 shadow-[0_0_40px_rgba(34,197,94,0.05)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${anyAgentActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em]">AI Command Center</span>
            </div>
            <h2 className="text-2xl font-semibold text-slate-100">
              AI Orchestrator <span className={anyAgentActive ? "text-emerald-400" : "text-slate-500"}>{anyAgentActive ? "Active" : "Standby"}</span>
            </h2>
            <p className="text-slate-400 text-sm">Real-time orchestration of your AI agents</p>
          </div>
          <div className="hidden lg:flex flex-col items-center gap-1">
            <p className="text-[10px] tracking-[0.3em] text-indigo-300/90 font-semibold uppercase">
              Jarvis core: listening &amp; coordinating
            </p>
            <Waveform bars={52} height={30} color="#818cf8" />
          </div>
          <div className="flex gap-3">
            <RunScoutModal command />
            <AgentRunButton
              label="Run Full Sequence"
              runningLabel="Orchestrating…"
              action="sequence"
              icon={<RefreshCw size={15} />}
              className="bg-emerald-500/15 border border-emerald-500/50 text-emerald-400 px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-emerald-500/25 transition-all disabled:opacity-60"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Orchestration canvas */}
          <div className="xl:col-span-2 rounded-3xl border border-sky-500/15 bg-[#060a16] p-4 overflow-hidden relative">
            <div
              className="absolute inset-0 opacity-40"
              style={{ background: "radial-gradient(ellipse at center, rgba(56,189,248,0.07) 0%, transparent 65%)" }}
            />
            <OrchestrationCanvas nodes={nodes} />
          </div>

          {/* Right rail */}
          <div className="space-y-6">
            <MotionCard index={0} className="rounded-3xl border border-sky-500/15 bg-[#0a0f1e] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold tracking-[0.15em] text-slate-300 uppercase">Orchestration status</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1.5 ${anyAgentActive ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/40 text-slate-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${anyAgentActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                  {anyAgentActive ? "Live" : "Idle"}
                </span>
              </div>
              <div className="rounded-2xl bg-[#070b16] border border-sky-500/10 p-4 mb-4">
                <p className="text-[11px] text-slate-500 mb-1">Active workflow</p>
                <p className="text-sm font-semibold text-slate-100">Lead Generation Sequence</p>
                <div className="mt-2 opacity-70">
                  <Waveform bars={30} height={14} color="#38bdf8" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-slate-100">6</p>
                  <p className="text-[10px] text-slate-500">Total agents</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-400">{activeCount}</p>
                  <p className="text-[10px] text-slate-500">Active now</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-400">{completedCount}</p>
                  <p className="text-[10px] text-slate-500">Completed</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-400">{pendingCount}</p>
                  <p className="text-[10px] text-slate-500">Pending</p>
                </div>
              </div>
            </MotionCard>

            <MotionCard index={1} className="rounded-3xl border border-sky-500/15 bg-[#0a0f1e] p-5">
              <h3 className="text-xs font-semibold tracking-[0.15em] text-slate-300 uppercase mb-4">Current activity</h3>
              <div className="space-y-1">
                {currentActivity.map(({ node, line, at }, i) => (
                  <div
                    key={node.variant}
                    className={`flex items-start gap-3 p-2.5 rounded-xl ${node.status === "inprogress" ? "bg-amber-500/10 border border-amber-500/20" : ""}`}
                  >
                    <span
                      className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border shrink-0 mt-0.5"
                      style={{ background: "#0d1220", borderColor: `${node.color}66`, color: node.color }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold" style={{ color: node.color }}>{node.name}</p>
                        <p className="text-[10px] text-slate-500 shrink-0">
                          {node.status === "inprogress" ? "In progress" : node.status === "completed" ? (at ? timeAgo(at) : "Live") : "Pending"}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{line}</p>
                    </div>
                  </div>
                ))}
              </div>
            </MotionCard>

            <MotionCard index={2} className="rounded-3xl border border-sky-500/15 bg-[#0a0f1e] p-5">
              <h3 className="text-xs font-semibold tracking-[0.15em] text-slate-300 uppercase mb-3">AI core visualization</h3>
              <div className="flex items-center gap-4">
                <AiCoreViz size={120} />
                <div className="flex-1 rounded-2xl bg-[#070b16] border border-sky-500/10 p-3">
                  <p className="text-sm font-semibold text-sky-300">Listening…</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Analyzing inputs from {recentKeys.length} active agent{recentKeys.length === 1 ? "" : "s"}
                  </p>
                  {kpi.avgScore != null ? (
                    <p className="text-[11px] text-emerald-400 mt-1.5">Avg lead score: {kpi.avgScore}/10</p>
                  ) : null}
                </div>
              </div>
            </MotionCard>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {kpiCards.map((k, i) => (
            <MotionCard key={k.label} index={i} className="rounded-2xl border border-sky-500/15 bg-[#0a0f1e] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-slate-400">{k.label}</p>
                  <p className="text-[10px] text-slate-600 mb-1.5">{k.sub}</p>
                  <AnimatedNumber value={k.value} className="text-2xl font-bold" style={{ color: k.color }} />
                  <p className={`text-[10px] mt-1 ${k.delta == null ? "text-slate-600" : k.delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {k.delta == null ? `— ${k.deltaSub}` : `${k.delta >= 0 ? "+" : ""}${k.delta}% ${k.deltaSub}`}
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center border"
                  style={{ background: `${k.color}1a`, borderColor: `${k.color}40`, color: k.color }}
                >
                  <k.icon size={17} />
                </div>
              </div>
            </MotionCard>
          ))}
          <MotionCard index={4} className="rounded-2xl border border-sky-500/15 bg-[#0a0f1e] p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-slate-400">Contact Rate</p>
                <p className="text-[10px] text-slate-600 mb-1.5">Contacted / qualified</p>
                {conversionRate != null ? (
                  <p className="text-2xl font-bold text-emerald-400">{conversionRate}%</p>
                ) : (
                  <p className="text-2xl font-bold text-slate-600">—</p>
                )}
                <p className="text-[10px] mt-1 text-slate-600">all time</p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-emerald-500/10 border-emerald-500/25 text-emerald-400">
                <TrendingUp size={17} />
              </div>
            </div>
          </MotionCard>
        </div>
      </section>

      <TerminalLog command />
    </CommandShell>
  );
}
