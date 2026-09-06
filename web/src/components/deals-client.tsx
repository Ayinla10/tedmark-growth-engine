"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowUpDown, Briefcase, CheckCircle2,
  ChevronRight, CircleDot, Clock, FileText,
  MessageSquare, Search, TrendingUp, X, XCircle,
} from "lucide-react";
import type { DealRow } from "@/lib/queries";
import { formatDate } from "@/lib/time";

// ─── stage config ─────────────────────────────────────────────────────────────

const ACTIVE_STAGES = ["Qualified", "Proposal Sent", "Negotiating"] as const;
type ActiveStage = typeof ACTIVE_STAGES[number];

const STAGE_CONF: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  Qualified:       { dot: "rgb(107,159,255)", bg: "rgba(107,159,255,0.08)", border: "rgba(107,159,255,0.25)", text: "rgb(80,120,230)" },
  "Proposal Sent": { dot: "rgb(168,85,247)",  bg: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.25)",  text: "rgb(126,34,206)" },
  Negotiating:     { dot: "rgb(245,158,11)",  bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  text: "rgb(161,98,7)" },
  Won:             { dot: "rgb(34,197,94)",   bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.25)",   text: "rgb(21,128,61)" },
  Lost:            { dot: "rgb(239,68,68)",   bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.20)",   text: "rgb(185,28,28)" },
};

// ─── attention ────────────────────────────────────────────────────────────────

type AttentionSignal = { label: string; level: "high" | "medium" | "low" };

function attentionSignal(deal: DealRow): AttentionSignal | null {
  const now = Date.now();
  const DAY = 86400000;
  if (deal.next_action_due && new Date(deal.next_action_due).getTime() < now)
    return { label: "Action overdue", level: "high" };
  if (deal.pipeline_stage === "Proposal Sent" && deal.last_outreach_at) {
    const days = Math.floor((now - new Date(deal.last_outreach_at).getTime()) / DAY);
    if (days >= 3) return { label: `Follow up — ${days}d since proposal`, level: "high" };
  }
  if (deal.pipeline_stage === "Negotiating" && deal.last_outreach_at) {
    const days = Math.floor((now - new Date(deal.last_outreach_at).getTime()) / DAY);
    if (days >= 5) return { label: "Stalled — no activity", level: "medium" };
  }
  if (deal.pipeline_stage === "Qualified" && deal.last_outreach_at) {
    const days = Math.floor((now - new Date(deal.last_outreach_at).getTime()) / DAY);
    if (days >= 7) return { label: "No recent contact", level: "low" };
  }
  return null;
}

const ATTN: Record<"high"|"medium"|"low", { bg: string; border: string; text: string; icon: string }> = {
  high:   { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   text: "rgb(185,28,28)", icon: "rgb(239,68,68)" },
  medium: { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  text: "rgb(161,98,7)",  icon: "rgb(245,158,11)" },
  low:    { bg: "rgba(107,159,255,0.08)", border: "rgba(107,159,255,0.25)", text: "rgb(55,90,180)", icon: "rgb(107,159,255)" },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(v: number | null, c: string | null) {
  if (!v) return null;
  return `${c ?? ""}${v.toLocaleString()}`;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

function dealServices(d: DealRow) {
  const list = d.proposal_services?.length ? d.proposal_services : d.recommended_services;
  return list.slice(0, 2).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ");
}

function quickActionHref(deal: DealRow): { label: string; href: string } {
  if (deal.pipeline_stage === "Qualified" && !deal.proposal_id)
    return { label: "Prepare proposal", href: `/opportunities/${deal.id}` };
  if (deal.pipeline_stage === "Proposal Sent")
    return { label: "Follow up", href: `/conversations?conv=${deal.id}` };
  return { label: "View conversation", href: `/conversations?conv=${deal.id}` };
}

// ─── deal card ────────────────────────────────────────────────────────────────

function DealCard({ deal }: { deal: DealRow }) {
  const conf = STAGE_CONF[deal.pipeline_stage] ?? STAGE_CONF["Qualified"];
  const attn = attentionSignal(deal);
  const value = fmtMoney(deal.deal_value, deal.deal_currency);
  const services = dealServices(deal);
  const qa = quickActionHref(deal);

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
    >
      {/* Attention banner */}
      {attn && (
        <div
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
          style={{ background: ATTN[attn.level].bg, border: `1px solid ${ATTN[attn.level].border}`, color: ATTN[attn.level].text }}
        >
          <AlertCircle size={10} style={{ color: ATTN[attn.level].icon, flexShrink: 0 }} />
          {attn.label}
        </div>
      )}

      {/* Company */}
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
          style={{ background: conf.bg, color: conf.text, border: `1px solid ${conf.border}` }}
        >
          {initials(deal.business_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>
            {deal.business_name}
          </p>
          {services && (
            <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--ink-muted)" }}>{services}</p>
          )}
        </div>
        {value && (
          <p className="text-sm font-bold flex-shrink-0" style={{ color: "rgb(21,128,61)" }}>{value}</p>
        )}
      </div>

      {/* Last activity */}
      {deal.last_outreach_at && (
        <p className="text-[10px] flex items-center gap-1" style={{ color: "var(--ink-muted)" }}>
          <Clock size={9} />Last contact {formatDate(deal.last_outreach_at)}
        </p>
      )}

      {/* Stage + proposal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CircleDot size={10} style={{ color: conf.dot }} />
          <span className="text-[10px] font-semibold" style={{ color: conf.text }}>{deal.pipeline_stage}</span>
        </div>
        {deal.proposal_id
          ? <span className="text-[10px] flex items-center gap-1" style={{ color: "rgb(126,34,206)" }}><FileText size={9} />Proposal ready</span>
          : <span className="text-[10px]" style={{ color: "var(--ink-muted)" }}>No proposal</span>
        }
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: "var(--border-c)" }}>
        <Link
          href={qa.href}
          className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg transition-colors"
          style={{ background: "rgba(107,159,255,0.10)", color: "var(--brand)", border: "1px solid rgba(107,159,255,0.20)" }}
        >
          {qa.label}
        </Link>
        <Link
          href={`/deals/${deal.id}`}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "var(--surface-2)", color: "var(--ink-secondary)", border: "1px solid var(--border-c)" }}
        >
          Details <ChevronRight size={11} />
        </Link>
      </div>
    </div>
  );
}

// ─── closed card ──────────────────────────────────────────────────────────────

function ClosedCard({ deal }: { deal: DealRow }) {
  const isWon = deal.pipeline_stage === "Won";
  const value = fmtMoney(deal.deal_value, deal.deal_currency);
  const services = dealServices(deal);
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="flex items-start gap-3 rounded-xl p-3.5 hover:shadow-sm transition-shadow"
      style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
        style={{ background: isWon ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)" }}
      >
        {isWon ? <CheckCircle2 size={15} style={{ color: "rgb(34,197,94)" }} /> : <XCircle size={15} style={{ color: "rgb(239,68,68)" }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{deal.business_name}</p>
        {services && <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--ink-muted)" }}>{services}</p>}
        {deal.last_outreach_at && (
          <p className="text-[10px] mt-1" style={{ color: "var(--ink-muted)" }}>{formatDate(deal.last_outreach_at)}</p>
        )}
      </div>
      {value && (
        <p className="text-sm font-bold flex-shrink-0" style={{ color: isWon ? "rgb(21,128,61)" : "rgb(185,28,28)" }}>{value}</p>
      )}
    </Link>
  );
}

// ─── sort options ─────────────────────────────────────────────────────────────

type SortKey = "value" | "activity" | "stage" | "name";

function sortDeals(deals: DealRow[], key: SortKey): DealRow[] {
  return [...deals].sort((a, b) => {
    if (key === "value") return (b.deal_value ?? 0) - (a.deal_value ?? 0);
    if (key === "activity") {
      const at = a.last_outreach_at ?? a.created_at;
      const bt = b.last_outreach_at ?? b.created_at;
      return bt > at ? 1 : bt < at ? -1 : 0;
    }
    if (key === "stage") {
      const order = ["Qualified", "Proposal Sent", "Negotiating", "Won", "Lost"];
      return order.indexOf(a.pipeline_stage) - order.indexOf(b.pipeline_stage);
    }
    return a.business_name.localeCompare(b.business_name);
  });
}

// ─── main client component ────────────────────────────────────────────────────

export function DealsClient({ deals, proposalWizard }: { deals: DealRow[]; proposalWizard: ReactNode }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("value");

  // Filter by search query across all deals
  const filtered = useMemo(() => {
    if (!query.trim()) return deals;
    const q = query.toLowerCase();
    return deals.filter(d =>
      d.business_name.toLowerCase().includes(q) ||
      (d.sector ?? "").toLowerCase().includes(q) ||
      d.pipeline_stage.toLowerCase().includes(q)
    );
  }, [deals, query]);

  const sorted = useMemo(() => sortDeals(filtered, sortKey), [filtered, sortKey]);

  const activeDeals = sorted.filter(d => ACTIVE_STAGES.includes(d.pipeline_stage.trim() as ActiveStage));
  const wonDeals    = sorted.filter(d => d.pipeline_stage === "Won");
  const lostDeals   = sorted.filter(d => d.pipeline_stage === "Lost");

  // Attention items
  const attentionDeals = activeDeals
    .map(d => ({ deal: d, signal: attentionSignal(d) }))
    .filter(x => x.signal !== null)
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.signal!.level] - { high: 0, medium: 1, low: 2 }[b.signal!.level]));

  // Pipeline metrics from full (unfiltered) deals
  const allActive = deals.filter(d => ACTIVE_STAGES.includes(d.pipeline_stage as ActiveStage));
  const pipelineValue = allActive.reduce((s, d) => s + (d.deal_value ?? 0), 0);
  const wonValue = deals.filter(d => d.pipeline_stage === "Won").reduce((s, d) => s + (d.deal_value ?? 0), 0);
  const attentionCount = deals.filter(d => ACTIVE_STAGES.includes(d.pipeline_stage as ActiveStage) && attentionSignal(d)).length;

  const currencies = deals.map(d => d.deal_currency).filter(Boolean) as string[];
  const freqMap = currencies.reduce<Record<string, number>>((a, c) => { a[c] = (a[c] ?? 0) + 1; return a; }, {});
  const currency = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a])[0] ?? null;

  const byStage = new Map<ActiveStage, DealRow[]>();
  for (const s of ACTIVE_STAGES) byStage.set(s, []);
  for (const d of activeDeals) {
    const s = d.pipeline_stage.trim() as ActiveStage;
    if (byStage.has(s)) byStage.get(s)!.push(d);
  }

  const noDeals = deals.length === 0;
  const noResults = !noDeals && filtered.length === 0;

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--app-bg)" }}>

      {/* ── Header ── */}
      <div className="px-4 sm:px-6 pt-5 pb-4 border-b" style={{ borderColor: "var(--border-c)", background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Briefcase size={18} style={{ color: "var(--brand)" }} />
              <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>Deals</h1>
            </div>
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              Active sales opportunities you're working to close
            </p>
          </div>
          {proposalWizard}
        </div>

        {/* Summary metrics */}
        {!noDeals && (
          <div className="flex items-center gap-5 flex-wrap mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Active deals</p>
              <p className="text-2xl font-bold" style={{ color: "var(--ink)" }}>{allActive.length}</p>
            </div>
            {pipelineValue > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Pipeline value</p>
                <p className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
                  {currency ? `${currency} ` : ""}{pipelineValue.toLocaleString()}
                </p>
              </div>
            )}
            {attentionCount > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Need attention</p>
                <p className="text-2xl font-bold" style={{ color: "rgb(239,68,68)" }}>{attentionCount}</p>
              </div>
            )}
            {deals.filter(d => d.pipeline_stage === "Won").length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Won</p>
                <p className="text-2xl font-bold flex items-center gap-1" style={{ color: "rgb(21,128,61)" }}>
                  <TrendingUp size={16} />
                  {deals.filter(d => d.pipeline_stage === "Won").length}
                  {wonValue > 0 && ` · ${currency ? `${currency} ` : ""}${wonValue.toLocaleString()}`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Search + sort */}
        {!noDeals && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--ink-muted)" }} />
              <input
                type="text"
                placeholder="Search deals..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 rounded-lg text-sm"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-c)",
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--ink-muted)" }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={12} style={{ color: "var(--ink-muted)" }} />
              {(["value", "activity", "stage", "name"] as SortKey[]).map(k => (
                <button
                  key={k}
                  onClick={() => setSortKey(k)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg capitalize transition-all"
                  style={{
                    background: sortKey === k ? "var(--brand)" : "var(--surface-2)",
                    color: sortKey === k ? "#fff" : "var(--ink-secondary)",
                    border: "1px solid var(--border-c)",
                  }}
                >
                  {k === "activity" ? "Recent" : k}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {noDeals && (
        <div className="flex items-center justify-center p-8" style={{ minHeight: "60vh" }}>
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(107,159,255,0.10)" }}>
              <Briefcase size={28} style={{ color: "var(--brand)", opacity: 0.5 }} />
            </div>
            <h2 className="text-base font-bold mb-2" style={{ color: "var(--ink)" }}>Your sales pipeline is empty</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--ink-muted)" }}>
              When an opportunity becomes a serious sales conversation, use <strong>Convert to deal</strong> on the Opportunities page to add it here.
            </p>
            <a
              href="/opportunities"
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl"
              style={{ background: "rgba(107,159,255,0.12)", color: "var(--brand)", border: "1px solid rgba(107,159,255,0.25)" }}
            >
              View opportunities <ChevronRight size={14} />
            </a>
          </div>
        </div>
      )}

      {/* ── No search results ── */}
      {noResults && (
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>No deals match "{query}"</p>
            <button onClick={() => setQuery("")} className="text-xs mt-1" style={{ color: "var(--brand)" }}>Clear search</button>
          </div>
        </div>
      )}

      {!noDeals && !noResults && (
        <div className="p-4 md:p-5 space-y-6">

          {/* ── Needs attention ── */}
          {attentionDeals.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
                Needs your attention
              </h2>
              <div className="space-y-2">
                {attentionDeals.slice(0, 5).map(({ deal, signal }) => {
                  const c = ATTN[signal!.level];
                  const value = fmtMoney(deal.deal_value, deal.deal_currency);
                  const qa = quickActionHref(deal);
                  return (
                    <div
                      key={deal.id}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: c.bg, border: `1px solid ${c.border}` }}
                    >
                      <AlertCircle size={14} style={{ color: c.icon, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                          {deal.business_name}
                          {value && <span className="font-normal ml-1.5" style={{ color: c.text }}>{value}</span>}
                        </p>
                        <p className="text-[11px]" style={{ color: c.text }}>{signal!.label}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link
                          href={qa.href}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                        >
                          {qa.label}
                        </Link>
                        <Link href={`/deals/${deal.id}`}>
                          <ChevronRight size={14} style={{ color: c.icon }} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Active pipeline ── */}
          {activeDeals.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
                Active pipeline
              </h2>

              {/* Desktop: 3 columns */}
              <div className="hidden md:grid grid-cols-3 gap-4">
                {ACTIVE_STAGES.map(stage => {
                  const stageDeals = byStage.get(stage) ?? [];
                  const conf = STAGE_CONF[stage];
                  const stageValue = stageDeals.reduce((s, d) => s + (d.deal_value ?? 0), 0);
                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <CircleDot size={11} style={{ color: conf.dot }} />
                          <span className="text-xs font-bold" style={{ color: conf.text }}>{stage}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {stageValue > 0 && (
                            <span className="text-[10px] font-semibold" style={{ color: "var(--ink-muted)" }}>
                              {currency ? `${currency} ` : ""}{stageValue.toLocaleString()}
                            </span>
                          )}
                          <span
                            className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: conf.bg, color: conf.text }}
                          >
                            {stageDeals.length}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {stageDeals.length === 0 ? (
                          <div className="rounded-2xl p-4 text-center" style={{ background: "var(--surface)", border: `1.5px dashed ${conf.border}` }}>
                            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>No deals here</p>
                          </div>
                        ) : (
                          stageDeals.map(d => <DealCard key={d.id} deal={d} />)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile: grouped by stage */}
              <div className="md:hidden space-y-4">
                {ACTIVE_STAGES.map(stage => {
                  const stageDeals = byStage.get(stage) ?? [];
                  if (!stageDeals.length) return null;
                  const conf = STAGE_CONF[stage];
                  return (
                    <div key={stage}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <CircleDot size={11} style={{ color: conf.dot }} />
                        <span className="text-xs font-bold" style={{ color: conf.text }}>{stage}</span>
                        <span className="text-[10px]" style={{ color: "var(--ink-muted)" }}>· {stageDeals.length}</span>
                      </div>
                      <div className="space-y-3">{stageDeals.map(d => <DealCard key={d.id} deal={d} />)}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Won ── */}
          {wonDeals.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>Won</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {wonDeals.map(d => <ClosedCard key={d.id} deal={d} />)}
              </div>
            </section>
          )}

          {/* ── Lost ── */}
          {lostDeals.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>Lost</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {lostDeals.map(d => <ClosedCard key={d.id} deal={d} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
