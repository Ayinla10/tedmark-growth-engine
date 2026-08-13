import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ScoreBadge, StatusBadge } from "@/components/ui";
import { FunnelDonut, TrendChart, SectorBars, Sparkline } from "@/components/dashboard-charts";
import {
  getDueActions,
  getKpiSummary,
  getRecentQualifiedLeads,
  getSectorBreakdown,
  getLeadsTrend,
} from "@/lib/queries";
import { formatDate } from "@/lib/time";
import { AlertTriangle, ArrowUpRight, Building2, CheckCircle2, Mail, MessageSquare, TrendingUp, Users } from "lucide-react";

export const dynamic = "force-dynamic";

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  filled,
  change,
  up,
  index = 0,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ElementType;
  filled?: boolean;
  change?: string;
  up?: boolean;
  index?: number;
}) {
  if (filled) {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col gap-3"
        style={{
          background: "linear-gradient(135deg, var(--brand) 0%, color-mix(in srgb, var(--brand) 75%, #000) 100%)",
          animationDelay: `${index * 60}ms`,
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
            {label.toUpperCase()}
          </p>
          <Icon size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
        </div>
        <div>
          <p className="text-3xl font-bold tabular-nums" style={{ color: "#fff" }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {hint && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
              {hint}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-auto pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          {change ? (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
              {up ? <ArrowUpRight size={13} /> : null}
              {change}
            </span>
          ) : <span />}
          <Sparkline up={up ?? true} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-c)",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide" style={{ color: "var(--ink-muted)" }}>
          {label.toUpperCase()}
        </p>
        <Icon size={16} style={{ color: "var(--ink-muted)" }} />
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {hint && (
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
            {hint}
          </p>
        )}
      </div>
      {change ? (
        <div className="mt-auto pt-1 flex items-center gap-1 text-xs font-medium" style={{ borderTop: "1px solid var(--border-c)", color: "var(--ink-muted)" }}>
          {up ? <ArrowUpRight size={13} style={{ color: "var(--brand)" }} /> : null}
          <span>{change}</span>
        </div>
      ) : (
        <div style={{ height: "1.25rem" }} />
      )}
    </div>
  );
}

function SectionCard({ title, children, action, className = "" }: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
    >
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-c)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const [kpi, recent, dueActions, sectors, trend] = await Promise.all([
    getKpiSummary(),
    getRecentQualifiedLeads(6),
    getDueActions(),
    getSectorBreakdown(7),
    getLeadsTrend(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = dueActions.filter((l) => (l.next_action_due ?? "") < today).length;

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <AppShell>
      <section className="p-6 min-h-screen" style={{ background: "var(--app-bg)" }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>Overview</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <Link
                href="/qualified-leads"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: "rgb(239 68 68 / 0.1)", color: "rgb(239 68 68)" }}
              >
                <AlertTriangle size={12} />
                {overdueCount} overdue
              </Link>
            )}
            <Link
              href="/lead-discovery"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              <TrendingUp size={12} />
              All leads
            </Link>
          </div>
        </div>

        {/* ── KPI row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            index={0} filled
            label="Businesses found"
            value={kpi.leadsTotal}
            hint={kpi.leadsToday > 0 ? `+${kpi.leadsToday} today` : "Running daily at 7 AM"}
            icon={Building2}
            change={kpi.leadsToday > 0 ? `+${kpi.leadsToday} today` : "Auto-scout active"}
            up
          />
          <MetricCard
            index={1} filled
            label="Qualified leads"
            value={kpi.qualified}
            hint={kpi.avgScore != null ? `Avg score ${kpi.avgScore}/10` : "No scores yet"}
            icon={CheckCircle2}
            change={kpi.avgScore != null ? `${kpi.avgScore}/10 avg score` : undefined}
            up
          />
          <MetricCard
            index={2} filled
            label="Outreach drafts"
            value={kpi.drafts}
            hint="Awaiting your approval"
            icon={Mail}
            change="Pending approval"
          />
          <MetricCard
            index={3} filled
            label="Contacted"
            value={kpi.contacted}
            hint={kpi.replied > 0 ? `${kpi.replied} replied` : "Messages sent"}
            icon={MessageSquare}
            change={kpi.replied > 0 ? `${kpi.replied} replied` : undefined}
            up={kpi.replied > 0}
          />
        </div>

        {/* ── Secondary KPI row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard label="Replies received" value={kpi.replied} icon={MessageSquare} change={kpi.replied > 0 ? "Active conversations" : undefined} up />
          <MetricCard label="Proposals sent" value={kpi.proposals} icon={Users} change={kpi.proposals > 0 ? "In review" : undefined} up />
          <MetricCard label="Follow-ups pending" value={kpi.pendingFollowUps} icon={AlertTriangle} change={kpi.pendingFollowUps > 0 ? "Awaiting replies" : undefined} />
          <MetricCard label="Pipeline actions due" value={dueActions.length} icon={CheckCircle2} change={overdueCount > 0 ? `${overdueCount} overdue` : "All on track"} up={overdueCount === 0} />
        </div>

        {/* ── Charts row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* Trend chart — 2/3 width */}
          <div
            className="lg:col-span-2 rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-c)" }}>
              <div className="flex items-center gap-4">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Lead discovery</p>
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--ink-muted)" }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded-full" style={{ background: "var(--brand)", opacity: 0.4 }} />
                    Found
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded-full" style={{ background: "var(--brand)" }} />
                    Qualified
                  </span>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--ink-muted)" }}>
                Last 30 days
              </span>
            </div>
            <div className="px-5 py-4">
              <TrendChart data={trend} />
            </div>
          </div>

          {/* Funnel donut — 1/3 width */}
          <SectionCard title="Pipeline funnel">
            <FunnelDonut
              raw={kpi.funnel.raw}
              qualified={kpi.funnel.qualified}
              contacted={kpi.funnel.contacted}
              archived={kpi.funnel.archived}
            />
            <p className="text-xs mt-4 pt-3" style={{ color: "var(--ink-muted)", borderTop: "1px solid var(--border-c)" }}>
              {kpi.pendingFollowUps} follow-up{kpi.pendingFollowUps !== 1 ? "s" : ""} pending
            </p>
          </SectionCard>
        </div>

        {/* ── Bottom row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Sector breakdown */}
          <SectionCard
            title="Leads by sector"
            action={
              <Link href="/lead-discovery" className="text-xs" style={{ color: "var(--brand)" }}>
                View all →
              </Link>
            }
          >
            <SectorBars sectors={sectors} />
          </SectionCard>

          {/* Top qualified leads table — 2/3 */}
          <div
            className="lg:col-span-2 rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-c)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Top qualified leads</p>
              <Link href="/qualified-leads" className="text-xs" style={{ color: "var(--brand)" }}>
                View all →
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="text-center py-12 px-5">
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>No qualified leads yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>Run the qualifier agent to score discovered businesses</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-c)" }}>
                      {["Business", "Sector", "Score", "Status", "Found"].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-2.5 text-left text-xs font-medium whitespace-nowrap"
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
                        style={{
                          borderBottom: i < recent.length - 1 ? "1px solid var(--border-c)" : "none",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/leads/${lead.id}`}
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
                          <ScoreBadge score={lead.score} />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums" style={{ color: "var(--ink-muted)" }}>
                          {formatDate(lead.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Due actions (if any) ─────────────────────────────────────── */}
        {dueActions.length > 0 && (
          <div
            className="mt-4 rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-c)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Next actions due</p>
              {overdueCount > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "rgb(239 68 68 / 0.1)", color: "rgb(239 68 68)" }}>
                  {overdueCount} overdue
                </span>
              )}
            </div>
            <div className="divide-y" style={{ "--tw-divide-color": "var(--border-c)" } as React.CSSProperties}>
              {dueActions.map((lead) => {
                const overdue = (lead.next_action_due ?? "") < today;
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between px-5 py-3 text-sm"
                    style={{ color: "var(--ink)" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <span className="font-medium">{lead.business_name}</span>
                    <span style={{ color: "var(--ink-secondary)" }}>{lead.next_action}</span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: overdue ? "rgb(239 68 68)" : "var(--ink-muted)" }}
                    >
                      {lead.next_action_due}{overdue ? " · overdue" : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </section>
    </AppShell>
  );
}
