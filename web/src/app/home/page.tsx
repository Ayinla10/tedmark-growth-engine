import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { TrendChart } from "@/components/dashboard-charts";
import { StatusBadge } from "@/components/ui";
import {
  getDueActions,
  getGrowthStats,
  getKpiSummary,
  getLatestAnalyticsSnapshot,
  getPipelineStageBreakdown,
  getRecentQualifiedLeads,
  getSectorBreakdown,
  getLeadsTrend,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  Minus,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

/* ── Delta badge ─────────────────────────────────────────────────────────── */
function Delta({ today, yesterday }: { today: number; yesterday: number }) {
  if (yesterday === 0 && today === 0) return null;
  const diff = today - yesterday;
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium" style={{ color: "var(--ink-muted)" }}>
        <Minus size={9} /> same as yesterday
      </span>
    );
  const up = diff > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-medium"
      style={{ color: up ? "rgb(34 197 94)" : "rgb(239 68 68)" }}
    >
      <ArrowUpRight size={9} style={{ transform: up ? "none" : "rotate(90deg)" }} />
      {up ? "+" : ""}
      {diff} vs yesterday
    </span>
  );
}

/* ── Metric tile ─────────────────────────────────────────────────────────── */
function MetricTile({
  label,
  value,
  delta,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number | string;
  delta?: { today: number; yesterday: number };
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-1.5"
      style={{
        background: "var(--surface)",
        border: `1px solid ${highlight ? "rgba(107,159,255,0.35)" : "var(--border-c)"}`,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon size={13} style={{ color: highlight ? "var(--brand)" : "var(--ink-muted)", flexShrink: 0 }} />
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {label}
        </p>
      </div>
      <p className="text-2xl font-semibold tabular-nums leading-none" style={{ color: "var(--ink)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {delta && <Delta today={delta.today} yesterday={delta.yesterday} />}
    </div>
  );
}

/* ── Pipeline stage row ──────────────────────────────────────────────────── */
const STAGE_COLORS: Record<string, string> = {
  New:            "#6b9fff",
  Contacted:      "#fbbf24",
  Qualified:      "#34d399",
  "Proposal Sent":"#f59e0b",
  Negotiating:    "#a78bfa",
  Won:            "#22c55e",
  Lost:           "#ef4444",
};

function StageRow({ stage, count, max }: { stage: string; count: number; max: number }) {
  const color = STAGE_COLORS[stage] ?? "var(--brand)";
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-24 shrink-0" style={{ color: "var(--ink-secondary)" }}>
        {stage}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-6 text-right shrink-0" style={{ color: "var(--ink)" }}>
        {count}
      </span>
    </div>
  );
}

export default async function HomePage() {
  const [session, kpi, growthStats, recent, dueActions, sectors, trend, analyticsSnapshot, pipelineStages] =
    await Promise.all([
      getSession(),
      getKpiSummary(),
      getGrowthStats(),
      getRecentQualifiedLeads(5),
      getDueActions(10),
      getSectorBreakdown(5),
      getLeadsTrend(),
      getLatestAnalyticsSnapshot(),
      getPipelineStageBreakdown(),
    ]);

  const firstName = session?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const today = new Date().toISOString().slice(0, 10);
  const overdueActions = dueActions.filter((l) => (l.next_action_due ?? "") < today);
  const todayActions = dueActions.filter((l) => l.next_action_due === today);

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  /* ── Attention items ───────────────────────────────────────────────────── */
  const attentionItems: {
    key: string;
    label: string;
    href: string;
    cta: string;
    alert: boolean;
  }[] = [];

  if (kpi.drafts > 0) {
    attentionItems.push({
      key: "drafts",
      label: `${kpi.drafts} outreach draft${kpi.drafts !== 1 ? "s" : ""} awaiting your approval`,
      href: "/conversations",
      cta: "Approve drafts",
      alert: false,
    });
  }
  if (kpi.replied > 0) {
    attentionItems.push({
      key: "replies",
      label: `${kpi.replied} conversation${kpi.replied !== 1 ? "s" : ""} ${kpi.replied !== 1 ? "have" : "has"} a reply to review`,
      href: "/conversations",
      cta: "Review replies",
      alert: false,
    });
  }
  if (overdueActions.length > 0) {
    attentionItems.push({
      key: "overdue",
      label: `${overdueActions.length} follow-up${overdueActions.length !== 1 ? "s are" : " is"} overdue`,
      href: "/conversations",
      cta: "View overdue",
      alert: true,
    });
  }
  if (todayActions.length > 0) {
    attentionItems.push({
      key: "today",
      label: `${todayActions.length} action${todayActions.length !== 1 ? "s" : ""} due today`,
      href: "/opportunities",
      cta: "View actions",
      alert: false,
    });
  }

  /* ── Next best action ──────────────────────────────────────────────────── */
  let nextAction = {
    label: "Discover new opportunities",
    why: "The AI Copilot can find businesses in your target sectors right now.",
    href: "/copilot",
    cta: "Open AI Copilot",
  };
  if (kpi.drafts > 0) {
    nextAction = {
      label: `Approve ${kpi.drafts} outreach draft${kpi.drafts !== 1 ? "s" : ""}`,
      why: `${kpi.drafts !== 1 ? "These messages are" : "This message is"} written and ready — approve to send.`,
      href: "/conversations",
      cta: "Review drafts",
    };
  } else if (kpi.replied > 0) {
    nextAction = {
      label: `Review ${kpi.replied} repl${kpi.replied !== 1 ? "ies" : "y"}`,
      why: `A prospect responded to your outreach — reply quickly to keep the conversation warm.`,
      href: "/conversations",
      cta: "View replies",
    };
  } else if (overdueActions.length > 0) {
    nextAction = {
      label: `${overdueActions.length} overdue follow-up${overdueActions.length !== 1 ? "s" : ""}`,
      why: `${overdueActions.length !== 1 ? "These leads have" : "This lead has"} a next action that is past due.`,
      href: "/conversations",
      cta: "View follow-ups",
    };
  } else if (kpi.pendingFollowUps > 0) {
    nextAction = {
      label: "Send follow-up messages",
      why: `${kpi.pendingFollowUps} follow-up${kpi.pendingFollowUps !== 1 ? "s are" : " is"} scheduled and waiting to be sent.`,
      href: "/conversations",
      cta: "View follow-ups",
    };
  } else if (kpi.qualified > 0) {
    nextAction = {
      label: "Review your qualified businesses",
      why: `${kpi.qualified} business${kpi.qualified !== 1 ? "es have" : " has"} been researched and is ready for outreach.`,
      href: "/opportunities",
      cta: "View opportunities",
    };
  }

  /* ── AI insight ────────────────────────────────────────────────────────── */
  let aiInsight: string | null = null;
  if (analyticsSnapshot?.summary) {
    aiInsight = analyticsSnapshot.summary;
  } else if (sectors.length > 0) {
    const topSector = sectors[0];
    aiInsight = `Most opportunities are in the ${topSector.sector} sector (${topSector.count} businesses found).`;
    if (sectors[1]) {
      aiInsight += ` ${sectors[1].sector} is second with ${sectors[1].count}.`;
    }
  } else if (kpi.avgScore != null) {
    aiInsight = `Average fit score across your pipeline: ${kpi.avgScore}/10.`;
  }

  /* ── Pipeline stage total ──────────────────────────────────────────────── */
  const pipelineMax = Math.max(...pipelineStages.map((s) => s.count), 1);
  const pipelineTotal = pipelineStages.reduce((n, s) => n + s.count, 0);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen" style={{ background: "var(--app-bg)" }}>

        {/* ── Greeting header ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
            {greeting}, {firstName}.
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>
            {dateLabel} · Here&apos;s what needs your attention.
          </p>
        </div>

        {/* ═══ SECTION 1 — NEEDS YOUR ATTENTION ════════════════════════════ */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: "var(--ink-muted)" }}>
            Needs attention
          </p>

          {attentionItems.length === 0 ? (
            <div
              className="rounded-xl flex items-start gap-3 px-4 py-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <CheckCircle2 size={17} style={{ color: "var(--brand)", flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  You&apos;re all caught up
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
                  No pending approvals, replies, or overdue actions. Your AI is working in the background.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {attentionItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl flex items-center justify-between gap-4 px-4 py-3"
                  style={{
                    background: "var(--surface)",
                    border: `1px solid ${item.alert ? "rgba(239,68,68,0.25)" : "var(--border-c)"}`,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.alert ? (
                      <AlertTriangle size={14} style={{ color: "rgb(239 68 68)", flexShrink: 0 }} />
                    ) : (
                      <Clock size={14} style={{ color: "var(--brand)", flexShrink: 0 }} />
                    )}
                    <p className="text-sm" style={{ color: item.alert ? "rgb(239 68 68)" : "var(--ink)" }}>
                      {item.label}
                    </p>
                  </div>
                  <Link
                    href={item.href}
                    className="flex items-center gap-1 text-xs font-medium whitespace-nowrap px-3 py-1.5 rounded-lg shrink-0"
                    style={{
                      background: item.alert ? "rgba(239,68,68,0.08)" : "var(--surface-2)",
                      color: item.alert ? "rgb(239 68 68)" : "var(--brand)",
                    }}
                  >
                    {item.cta}
                    <ArrowRight size={11} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ═══ SECTION 2 — NEXT BEST ACTION ════════════════════════════════ */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: "var(--ink-muted)" }}>
            Next best action
          </p>
          <div
            className="rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-c)",
              borderLeft: "3px solid var(--brand)",
            }}
          >
            <Zap size={16} style={{ color: "var(--brand)", flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {nextAction.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                {nextAction.why}
              </p>
            </div>
            <Link
              href={nextAction.href}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg shrink-0 whitespace-nowrap"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              {nextAction.cta}
              <ArrowRight size={12} />
            </Link>
          </div>
        </section>

        {/* ═══ SECTION 3 — TODAY'S GROWTH ══════════════════════════════════ */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: "var(--ink-muted)" }}>
            Today&apos;s growth
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricTile
              label="Businesses found"
              value={growthStats.leadsToday}
              delta={{ today: growthStats.leadsToday, yesterday: growthStats.leadsYesterday }}
              icon={Building2}
            />
            <MetricTile
              label="Researched today"
              value={growthStats.qualifiedToday}
              delta={{ today: growthStats.qualifiedToday, yesterday: growthStats.qualifiedYesterday }}
              icon={TrendingUp}
            />
            <MetricTile
              label="Messages sent"
              value={growthStats.outreachSentToday}
              delta={{ today: growthStats.outreachSentToday, yesterday: growthStats.outreachSentYesterday }}
              icon={Mail}
            />
            <MetricTile
              label="Proposals this week"
              value={growthStats.proposalsThisWeek}
              delta={{ today: growthStats.proposalsThisWeek, yesterday: growthStats.proposalsLastWeek }}
              icon={FileText}
            />
          </div>

          {/* Lifetime pipeline counts as a secondary row */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
            {[
              { label: "Total opportunities", value: kpi.leadsTotal, icon: Building2 },
              { label: "Qualified", value: kpi.qualified, icon: TrendingUp },
              { label: "Contacted", value: kpi.contacted, icon: Mail },
              { label: "Replied", value: kpi.replied, icon: MessageSquare, highlight: kpi.replied > 0 },
              { label: "Proposals", value: kpi.proposals, icon: FileText },
            ].map(({ label, value, icon: Icon, highlight }) => (
              <div
                key={label}
                className="rounded-xl px-3 py-2.5"
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${highlight ? "rgba(107,159,255,0.3)" : "var(--border-c)"}`,
                }}
              >
                <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>{label}</p>
                <p
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: highlight ? "var(--brand)" : "var(--ink)" }}
                >
                  {value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ SECTION 4 — PIPELINE SNAPSHOT ═══════════════════════════════ */}
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Pipeline by stage */}
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: "var(--ink-muted)" }}>
                  Pipeline
                </p>
                <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  {pipelineTotal} active
                </span>
              </div>
              <div className="space-y-2.5">
                {pipelineStages.map((s) => (
                  <StageRow key={s.pipeline_stage} stage={s.pipeline_stage} count={s.count} max={pipelineMax} />
                ))}
              </div>
              <Link
                href="/opportunities"
                className="mt-4 flex items-center gap-1 text-xs font-medium"
                style={{ color: "var(--brand)" }}
              >
                View all opportunities <ArrowRight size={11} />
              </Link>
            </div>

            {/* Trend chart */}
            <div
              className="lg:col-span-2 rounded-xl p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: "var(--ink-muted)" }}>
                  Opportunities discovered — last 30 days
                </p>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: "var(--brand)", opacity: 0.4 }} />
                    Found
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: "var(--brand)" }} />
                    Researched
                  </span>
                </div>
              </div>
              <TrendChart data={trend} />
            </div>
          </div>
        </section>

        {/* ═══ SECTION 5 — AI INSIGHT + TOP OPPORTUNITIES ══════════════════ */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* AI insight */}
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: "var(--ink-muted)" }}>
                AI insight
              </p>
              {aiInsight ? (
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
                  {aiInsight}
                </p>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                    Insights will appear as the AI processes more data through your pipeline.
                  </p>
                  <Link
                    href="/copilot"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
                    style={{ background: "var(--brand)", color: "#fff" }}
                  >
                    <TrendingUp size={12} />
                    Run AI tasks
                  </Link>
                </>
              )}
              {kpi.avgScore != null && (
                <p className="text-xs mt-3 pt-3" style={{ color: "var(--ink-muted)", borderTop: "1px solid var(--border-c)" }}>
                  Average fit score: <strong style={{ color: "var(--ink)" }}>{kpi.avgScore}/10</strong>
                </p>
              )}
            </div>

            {/* Top opportunities */}
            <div
              className="lg:col-span-2 rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: "1px solid var(--border-c)" }}
              >
                <p className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: "var(--ink-muted)" }}>
                  Top opportunities
                </p>
                <Link
                  href="/opportunities"
                  className="text-xs flex items-center gap-1"
                  style={{ color: "var(--brand)" }}
                >
                  View all <ArrowRight size={11} />
                </Link>
              </div>

              {recent.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Users size={20} className="mx-auto mb-2" style={{ color: "var(--ink-muted)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                    No researched businesses yet
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>
                    The AI scores and surfaces businesses automatically each day.
                  </p>
                  <Link
                    href="/copilot"
                    className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium px-3 py-2 rounded-lg"
                    style={{ background: "var(--brand)", color: "#fff" }}
                  >
                    <TrendingUp size={12} />
                    Find businesses now
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-c)" }}>
                        {["Business", "Sector", "Fit score", "Status"].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-2.5 text-left text-xs font-medium"
                            style={{ color: "var(--ink-muted)" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((lead, i) => (
                        <tr
                          key={lead.id}
                          className="row-hover"
                          style={{
                            borderBottom: i < recent.length - 1 ? "1px solid var(--border-c)" : "none",
                          }}
                        >
                          <td className="px-5 py-3">
                            <Link
                              href={`/opportunities/${lead.id}`}
                              className="text-sm font-medium hover:underline"
                              style={{ color: "var(--brand)" }}
                            >
                              {lead.business_name}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-sm capitalize" style={{ color: "var(--ink-secondary)" }}>
                            {lead.sector ?? "—"}
                          </td>
                          <td className="px-5 py-3">
                            {lead.score != null ? (
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums"
                                style={{
                                  background:
                                    lead.score >= 7
                                      ? "rgba(34,197,94,0.12)"
                                      : lead.score >= 5
                                      ? "rgba(234,179,8,0.12)"
                                      : "var(--surface-2)",
                                  color:
                                    lead.score >= 7
                                      ? "rgb(21 128 61)"
                                      : lead.score >= 5
                                      ? "rgb(133 77 14)"
                                      : "var(--ink-muted)",
                                }}
                              >
                                {lead.score}/10
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--ink-muted)" }}>—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={lead.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
}
