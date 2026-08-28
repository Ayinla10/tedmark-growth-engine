import type React from "react";
import { RefreshCw, Search, FlaskConical, MessageSquare, RotateCcw, BarChart2, Zap } from "lucide-react";
import { AgentRunButton } from "@/components/agent-run-button";
import { AppShell } from "@/components/app-shell";
import { RunScoutModal } from "@/components/run-scout-modal";
import {
  getAgentActivity,
  getFollowUps,
  getKpiSummary,
  getLatestAnalyticsSnapshot,
  getOutreach,
  getProposals,
  getRecentQualifiedLeads,
} from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { timeAgo } from "@/lib/time";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  const [kpi, topLeads, followUps, outreach, proposals, activity, analyticsSnapshot, settings] = await Promise.all([
    getKpiSummary(),
    getRecentQualifiedLeads(1),
    getFollowUps(),
    getOutreach(),
    getProposals(),
    getAgentActivity(),
    getLatestAnalyticsSnapshot(),
    getSettings(),
  ]);

  const topLead = topLeads[0] ?? null;
  const latestDraft = outreach.find((o) => o.status === "draft") ?? null;
  const pendingFollowUps = followUps.filter((f) => f.status === "pending").length;
  const draftCount = outreach.filter((o) => o.status === "draft").length;
  const latestProposal = proposals[0] ?? null;

  const recentRunAt = [
    activity.scoutLastRunAt,
    activity.qualifierLastRunAt,
    activity.outreachLastDraftAt,
    activity.sequencerLastRunAt,
    activity.analyticsLastRunAt,
  ].filter(Boolean);
  const anyRecentActivity = recentRunAt.length > 0;

  // Today's summary numbers
  const todaySummary: string[] = [];
  if (kpi.leadsToday > 0) todaySummary.push(`${kpi.leadsToday} businesses found`);
  if (draftCount > 0) todaySummary.push(`${draftCount} message${draftCount !== 1 ? "s" : ""} drafted`);
  if (pendingFollowUps > 0) todaySummary.push(`${pendingFollowUps} follow-up${pendingFollowUps !== 1 ? "s" : ""} scheduled`);

  return (
    <AppShell>
      <section className="px-4 pt-1 pb-64 space-y-6">

        {/* Header */}
        <div
          className="rounded-3xl p-6 flex items-center justify-between flex-wrap gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full ${anyRecentActivity ? "animate-pulse" : ""}`}
                style={{ background: anyRecentActivity ? "var(--brand)" : "var(--border-c)" }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ink-muted)" }}>
                AI Copilot
              </span>
            </div>
            <h2 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
              What would you like the AI to do?
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--ink-muted)" }}>
              Your AI assistant finds businesses, drafts messages, and manages follow-ups for you.
            </p>
          </div>
          <AgentRunButton
            label="Run all tasks"
            runningLabel="Running… (2–5 min)"
            action="pipeline"
            icon={<RefreshCw size={15} />}
            className="bg-[#2D6AF7]/20 border border-[#2D6AF7]/50 text-[#6b9fff] px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-[#2D6AF7]/30 transition-all disabled:opacity-60"
          />
        </div>

        {/* Today's summary */}
        {todaySummary.length > 0 && (
          <div
            className="rounded-2xl px-5 py-3 flex items-center gap-3 flex-wrap"
            style={{ background: "rgba(107,159,255,0.06)", border: "1px solid rgba(107,159,255,0.18)" }}
          >
            <Zap size={15} style={{ color: "var(--brand)" }} className="shrink-0" />
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              Today so far:
            </p>
            {todaySummary.map((item, i) => (
              <span
                key={i}
                className="text-sm px-2.5 py-0.5 rounded-full"
                style={{ background: "rgba(107,159,255,0.12)", color: "var(--brand)" }}
              >
                {item}
              </span>
            ))}
          </div>
        )}

        {/* Task cards */}
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4"
            style={{ color: "var(--ink-muted)" }}
          >
            Run a task
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

            {/* Find businesses */}
            <TaskCard
              icon={<Search size={18} />}
              iconColor="#38bdf8"
              title="Find businesses"
              description="Discover businesses in your target markets and add them to your pipeline."
              lastRan={activity.scoutLastRunAt}
              result={kpi.leadsToday > 0 ? `Found ${kpi.leadsToday} businesses today` : "No businesses found today"}
              resultHref="/opportunities"
            >
              <RunScoutModal command initialAutoEnabled={settings.scout_enabled} />
            </TaskCard>

            {/* Research businesses */}
            <TaskCard
              icon={<FlaskConical size={18} />}
              iconColor="#a78bfa"
              title="Research businesses"
              description="AI researches each business and scores how well they match your ideal customer."
              lastRan={activity.qualifierLastRunAt}
              result={
                topLead
                  ? `Top match: ${topLead.business_name}${topLead.score != null ? ` (${topLead.score}/10)` : ""}`
                  : "No businesses scored yet"
              }
              resultHref="/opportunities"
            >
              <AgentRunButton
                label="Research now"
                runningLabel="Researching…"
                action="qualify"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all bg-violet-500/15 text-violet-400 hover:bg-violet-500/25"
              />
            </TaskCard>

            {/* Draft messages */}
            <TaskCard
              icon={<MessageSquare size={18} />}
              iconColor="#fbbf24"
              title="Draft messages"
              description="AI writes personalised outreach messages for your qualified businesses."
              lastRan={activity.outreachLastDraftAt}
              result={
                draftCount > 0
                  ? `${draftCount} draft${draftCount !== 1 ? "s" : ""} awaiting your approval`
                  : latestDraft
                    ? `Latest: ${latestDraft.business_name}`
                    : "No messages drafted yet"
              }
              resultHref="/conversations"
              resultHighlight={draftCount > 0}
            >
              <AgentRunButton
                label="Draft now"
                runningLabel="Drafting…"
                action="outreach"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
              />
            </TaskCard>

            {/* Check follow-ups */}
            <TaskCard
              icon={<RotateCcw size={18} />}
              iconColor="#818cf8"
              title="Check follow-ups"
              description="Send follow-up messages to businesses that haven't responded yet."
              lastRan={activity.sequencerLastRunAt}
              result={
                pendingFollowUps > 0
                  ? `${pendingFollowUps} follow-up${pendingFollowUps !== 1 ? "s" : ""} scheduled`
                  : "No follow-ups pending"
              }
              resultHref="/conversations?tab=follow-ups"
              resultHighlight={pendingFollowUps > 0}
            >
              <AgentRunButton
                label="Check now"
                runningLabel="Checking…"
                action="sequence"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25"
              />
            </TaskCard>

            {/* Analyse performance */}
            <TaskCard
              icon={<BarChart2 size={18} />}
              iconColor="#34d399"
              title="Analyse performance"
              description="Review how your outreach is performing and identify what's working."
              lastRan={activity.analyticsLastRunAt}
              result={analyticsSnapshot?.summary ?? "No performance data yet"}
              resultHref="/growth"
            >
              <AgentRunButton
                label="Analyse now"
                runningLabel="Analysing…"
                action="analytics"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
              />
            </TaskCard>

            {/* Proposals — runs as part of full pipeline */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Prepare proposals</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                    AI prepares tailored proposals for businesses that have shown interest.
                  </p>
                </div>
              </div>
              {latestProposal && (
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  Latest: {latestProposal.business_name}
                </p>
              )}
              <div className="flex items-center gap-2 mt-auto pt-1">
                <span
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "var(--surface-2)", color: "var(--ink-muted)", border: "1px solid var(--border-c)" }}
                >
                  Runs automatically daily
                </span>
                <Link
                  href="/deals"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                >
                  View deals →
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* Recent activity */}
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3"
            style={{ color: "var(--ink-muted)" }}
          >
            Recent activity
          </p>
          <div
            className="rounded-2xl divide-y"
            style={{ background: "var(--surface)", border: "1px solid var(--border-c)", borderColor: "var(--border-c)" }}
          >
            {[
              { label: "Find businesses", at: activity.scoutLastRunAt, summary: kpi.leadsToday > 0 ? `Found ${kpi.leadsToday} businesses in your target markets` : "Scanned for businesses" },
              { label: "Research businesses", at: activity.qualifierLastRunAt, summary: topLead ? `${topLead.business_name} — ${(topLead.score ?? 0) >= 7 ? "strong" : "moderate"} match` : "No businesses researched yet" },
              { label: "Draft messages", at: activity.outreachLastDraftAt, summary: latestDraft ? `Drafted message for ${latestDraft.business_name}` : "No messages drafted yet" },
              { label: "Check follow-ups", at: activity.sequencerLastRunAt, summary: pendingFollowUps > 0 ? `${pendingFollowUps} follow-up${pendingFollowUps !== 1 ? "s" : ""} scheduled` : "No follow-ups pending" },
              { label: "Analyse performance", at: activity.analyticsLastRunAt, summary: analyticsSnapshot?.summary ?? "No performance data yet" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>{item.label}</p>
                  <p className="text-xs truncate" style={{ color: "var(--ink-muted)" }}>{item.summary}</p>
                </div>
                <p className="text-[11px] shrink-0 tabular-nums" style={{ color: "var(--ink-muted)" }}>
                  {item.at ? timeAgo(item.at) : "Never run"}
                </p>
              </div>
            ))}
          </div>
        </div>

      </section>
    </AppShell>
  );
}

function TaskCard({
  icon,
  iconColor,
  title,
  description,
  lastRan,
  result,
  resultHref,
  resultHighlight,
  children,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  description: string;
  lastRan: string | null;
  result: string;
  resultHref?: string;
  resultHighlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${iconColor}1a`, color: iconColor }}
        >
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-secondary)" }}>{description}</p>
        </div>
      </div>

      {/* Last result */}
      <div
        className="rounded-xl px-3 py-2"
        style={{ background: "var(--surface-2)", border: resultHighlight ? `1px solid ${iconColor}44` : "1px solid transparent" }}
      >
        <p
          className="text-xs"
          style={{ color: resultHighlight ? iconColor : "var(--ink-muted)" }}
        >
          {result}
        </p>
        {resultHref && (
          <a href={resultHref} className="text-[11px] font-medium hover:underline mt-0.5 block" style={{ color: "var(--brand)" }}>
            View in pipeline →
          </a>
        )}
      </div>

      {/* Last ran + action */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
          {lastRan ? `Last ran ${timeAgo(lastRan)}` : "Never run"}
        </p>
        {children}
      </div>
    </div>
  );
}
