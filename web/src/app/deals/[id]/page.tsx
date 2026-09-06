import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle, ArrowLeft, Briefcase, CheckCircle2,
  ChevronRight, CircleDot, Clock, ExternalLink,
  FileText, Mail, MessageSquare, Phone, XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProposalModal } from "@/components/proposal-modal";
import { DealStageChanger } from "@/components/deal-stage-changer";
import { getDealById } from "@/lib/queries";
import { formatDate } from "@/lib/time";

export const dynamic = "force-dynamic";

// ─── constants ────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = ["Qualified", "Proposal Sent", "Negotiating", "Won"] as const;

const STAGE_CONF: Record<string, { dot: string; bg: string; border: string; text: string; label: string }> = {
  Qualified:       { dot: "rgb(107,159,255)", bg: "rgba(107,159,255,0.10)", border: "rgba(107,159,255,0.25)", text: "rgb(80,120,230)",  label: "Qualified" },
  "Proposal Sent": { dot: "rgb(168,85,247)",  bg: "rgba(168,85,247,0.10)",  border: "rgba(168,85,247,0.25)",  text: "rgb(126,34,206)", label: "Proposal Sent" },
  Negotiating:     { dot: "rgb(245,158,11)",  bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)",  text: "rgb(161,98,7)",   label: "Negotiating" },
  Won:             { dot: "rgb(34,197,94)",   bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.25)",   text: "rgb(21,128,61)",  label: "Won" },
  Lost:            { dot: "rgb(239,68,68)",   bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.20)",   text: "rgb(185,28,28)",  label: "Lost" },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(value: number | null, currency: string | null): string | null {
  if (!value) return null;
  return `${currency ?? ""}${value.toLocaleString()}`;
}

function attentionSignal(deal: Awaited<ReturnType<typeof getDealById>>): {
  label: string; detail: string; level: "high" | "medium" | "low"
} | null {
  if (!deal) return null;
  const now = Date.now();
  const DAY = 86400000;

  if (deal.next_action_due) {
    const due = new Date(deal.next_action_due).getTime();
    if (due < now) {
      const days = Math.floor((now - due) / DAY);
      return {
        label: "Action overdue",
        detail: `Your scheduled action was due ${days === 0 ? "today" : `${days} day${days !== 1 ? "s" : ""} ago`}.`,
        level: "high",
      };
    }
  }
  if (deal.pipeline_stage === "Proposal Sent" && deal.last_outreach_at) {
    const age = now - new Date(deal.last_outreach_at).getTime();
    const days = Math.floor(age / DAY);
    if (days >= 3) {
      return {
        label: "Follow up on your proposal",
        detail: `The proposal was sent ${days} day${days !== 1 ? "s" : ""} ago with no response recorded.`,
        level: "high",
      };
    }
  }
  if (deal.pipeline_stage === "Negotiating" && deal.last_outreach_at) {
    const age = now - new Date(deal.last_outreach_at).getTime();
    const days = Math.floor(age / DAY);
    if (days >= 5) {
      return {
        label: "Deal appears stalled",
        detail: `No outreach activity recorded in ${days} day${days !== 1 ? "s" : ""}.`,
        level: "medium",
      };
    }
  }
  return null;
}

const ATTENTION_COLOR = {
  high:   { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   text: "rgb(185,28,28)", icon: "rgb(239,68,68)" },
  medium: { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  text: "rgb(161,98,7)",  icon: "rgb(245,158,11)" },
  low:    { bg: "rgba(107,159,255,0.08)", border: "rgba(107,159,255,0.25)", text: "rgb(55,90,180)", icon: "rgb(107,159,255)" },
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealById(id);
  if (!deal) notFound();

  const conf = STAGE_CONF[deal.pipeline_stage] ?? STAGE_CONF["Qualified"];
  const value = fmtMoney(deal.deal_value, deal.deal_currency);
  const attn = attentionSignal(deal);
  const isActive = !["Won", "Lost"].includes(deal.pipeline_stage);
  const isWon = deal.pipeline_stage === "Won";
  const isLost = deal.pipeline_stage === "Lost";

  const services = (
    (deal.proposal_services?.length ? deal.proposal_services : deal.recommended_services) ?? []
  ).map(s => s.charAt(0).toUpperCase() + s.slice(1));

  // Determine pipeline progress index
  const progressIdx = PIPELINE_STEPS.indexOf(
    isWon ? "Won" : isLost ? "Negotiating" : deal.pipeline_stage as typeof PIPELINE_STEPS[number]
  );

  // Build proposal row for ProposalModal if one exists
  const proposalRow = deal.proposal_id ? {
    id: deal.proposal_id,
    business_name: deal.business_name,
    lead_email: deal.dm_email ?? deal.email,
    services: deal.proposal_services,
    budget_range: deal.proposal_budget,
    content: deal.proposal_content,
  } : null;

  // Suggest next best action
  function suggestAction(): { label: string; detail: string; href?: string } | null {
    if (attn) return null; // attention section covers it
    if (deal!.pipeline_stage === "Qualified" && !deal!.proposal_id) {
      return { label: "Prepare a proposal", detail: "This deal is qualified — a proposal is the natural next step.", href: `/opportunities/${deal!.id}` };
    }
    if (deal!.pipeline_stage === "Proposal Sent") {
      return { label: "Await response or follow up", detail: "The proposal has been sent. Track replies in Conversations.", href: `/conversations?conv=${deal!.id}` };
    }
    if (deal!.pipeline_stage === "Negotiating") {
      return { label: "Advance the negotiation", detail: "Review the latest conversation and take the next step.", href: `/conversations?conv=${deal!.id}` };
    }
    return null;
  }

  const suggested = suggestAction();

  return (
    <AppShell>
      <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--app-bg)" }}>

        {/* ── Header bar ── */}
        <div
          className="sticky top-0 z-10 px-4 sm:px-6 py-3 border-b flex items-center gap-3"
          style={{ borderColor: "var(--border-c)", background: "var(--surface)" }}
        >
          <Link
            href="/deals"
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--ink-muted)" }}
          >
            <ArrowLeft size={15} /> Deals
          </Link>
          <div className="w-px h-4" style={{ background: "var(--border-c)" }} />
          <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
            {deal.business_name}
          </p>
          {value && (
            <>
              <div className="w-px h-4" style={{ background: "var(--border-c)" }} />
              <p className="text-sm font-bold" style={{ color: "rgb(21,128,61)" }}>{value}</p>
            </>
          )}
          <div className="ml-auto flex-shrink-0">
            <span
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: conf.bg, color: conf.text, border: `1px solid ${conf.border}` }}
            >
              <CircleDot size={9} style={{ color: conf.dot }} />
              {conf.label}
            </span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* ── Deal identity ── */}
          <div>
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-sm font-bold"
                style={{ background: conf.bg, color: conf.text, border: `1px solid ${conf.border}` }}
              >
                {deal.business_name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("")}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold leading-tight" style={{ color: "var(--ink)" }}>
                  {deal.business_name}
                </h1>
                {deal.sector && (
                  <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>{deal.sector}</p>
                )}
                {services.length > 0 && (
                  <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>
                    {services.join(" · ")}
                  </p>
                )}
              </div>
              {value && (
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold" style={{ color: "rgb(21,128,61)" }}>{value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-muted)" }}>Deal value</p>
                </div>
              )}
            </div>

            {/* Status badges for Won/Lost */}
            {(isWon || isLost) && (
              <div className="mt-3">
                {isWon && (
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl"
                    style={{ background: "rgba(34,197,94,0.12)", color: "rgb(21,128,61)", border: "1px solid rgba(34,197,94,0.25)" }}
                  >
                    <CheckCircle2 size={14} /> Deal won
                  </span>
                )}
                {isLost && (
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.08)", color: "rgb(185,28,28)", border: "1px solid rgba(239,68,68,0.20)" }}
                  >
                    <XCircle size={14} /> Deal lost
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Pipeline progress ── */}
          {!isLost && (
            <div
              className="rounded-2xl px-5 py-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
                Pipeline progress
              </p>
              <div className="flex items-center gap-0">
                {PIPELINE_STEPS.map((step, i) => {
                  const isPast = i < progressIdx;
                  const isCurrent = i === progressIdx;
                  const stepConf = STAGE_CONF[step];
                  return (
                    <div key={step} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            background: isPast || isCurrent ? stepConf.dot : "var(--border-c)",
                            border: isCurrent ? `2px solid ${stepConf.dot}` : "none",
                            boxShadow: isCurrent ? `0 0 0 3px ${stepConf.bg}` : "none",
                          }}
                        />
                        <p
                          className="text-[9px] font-semibold mt-1.5 text-center leading-tight"
                          style={{
                            color: isCurrent ? stepConf.text : isPast ? "var(--ink-secondary)" : "var(--ink-muted)",
                          }}
                        >
                          {step}
                        </p>
                      </div>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <div
                          className="h-px flex-1 mx-1 -mt-4"
                          style={{ background: i < progressIdx ? "var(--brand)" : "var(--border-c)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Needs attention ── */}
          {attn && (
            <div
              className="rounded-2xl p-4"
              style={{ background: ATTENTION_COLOR[attn.level].bg, border: `1px solid ${ATTENTION_COLOR[attn.level].border}` }}
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: ATTENTION_COLOR[attn.level].icon }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: ATTENTION_COLOR[attn.level].text }}>{attn.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-secondary)" }}>{attn.detail}</p>
                  <Link
                    href={`/conversations?conv=${deal.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold mt-2"
                    style={{ color: ATTENTION_COLOR[attn.level].text }}
                  >
                    Go to conversation <ChevronRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── Next best action ── */}
          {suggested && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "rgba(107,159,255,0.07)", border: "1px solid rgba(107,159,255,0.20)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--brand)" }}>
                Next best action
              </p>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--ink)" }}>{suggested.label}</p>
              <p className="text-xs mb-2.5" style={{ color: "var(--ink-secondary)" }}>{suggested.detail}</p>
              {suggested.href && (
                <Link
                  href={suggested.href}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: "var(--brand)", color: "#fff" }}
                >
                  {suggested.label} <ChevronRight size={11} />
                </Link>
              )}
            </div>
          )}

          {/* ── Proposal ── */}
          <div
            className="rounded-2xl p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
              Proposal
            </p>
            {proposalRow ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText size={14} style={{ color: "rgb(168,85,247)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                    {(deal.proposal_services ?? []).slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ") || "Proposal ready"}
                  </p>
                </div>
                {deal.proposal_budget && (
                  <p className="text-xs capitalize" style={{ color: "var(--ink-secondary)" }}>
                    Budget range: {deal.proposal_budget}
                  </p>
                )}
                {deal.proposal_created_at && (
                  <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                    Created {formatDate(deal.proposal_created_at)}
                  </p>
                )}
                <div className="pt-1">
                  <ProposalModal row={proposalRow} />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No proposal yet.</p>
                <Link
                  href={`/opportunities/${deal.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(107,159,255,0.12)", color: "var(--brand)", border: "1px solid rgba(107,159,255,0.25)" }}
                >
                  <FileText size={12} /> Create proposal
                </Link>
              </div>
            )}
          </div>

          {/* ── Move stage ── */}
          {isActive && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
                Move deal
              </p>
              <DealStageChanger dealId={deal.id} currentStage={deal.pipeline_stage} />
            </div>
          )}

          {/* Won/Lost — reopen option */}
          {!isActive && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
                Deal stage
              </p>
              <DealStageChanger dealId={deal.id} currentStage={deal.pipeline_stage} />
            </div>
          )}

          {/* ── Next action ── */}
          {(deal.next_action || deal.next_action_due) && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
                Scheduled action
              </p>
              {deal.next_action && (
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{deal.next_action}</p>
              )}
              {deal.next_action_due && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--ink-muted)" }}>
                  <Clock size={10} /> Due {formatDate(deal.next_action_due)}
                </p>
              )}
            </div>
          )}

          {/* ── Activity timeline ── */}
          {deal.outreach.length > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
                Activity
              </p>
              <div className="space-y-3">
                {deal.outreach.slice().reverse().map(o => {
                  const isEmail = o.message_type === "email";
                  const label = o.status === "sent"
                    ? isEmail ? "Email sent" : "WhatsApp sent"
                    : o.status === "draft" ? "Draft created" : "Message";
                  const ts = o.sent_at ?? o.created_at;
                  return (
                    <div key={o.id} className="flex items-start gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                        style={{ background: o.status === "sent" ? "rgba(107,159,255,0.15)" : "var(--surface-2)" }}
                      >
                        {isEmail
                          ? <Mail size={10} style={{ color: "var(--brand)" }} />
                          : <MessageSquare size={10} style={{ color: "var(--ink-muted)" }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                          {label}
                          {o.replied && (
                            <span
                              className="ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(34,197,94,0.12)", color: "rgb(21,128,61)" }}
                            >
                              replied
                            </span>
                          )}
                        </p>
                        {o.subject && (
                          <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                            {o.subject}
                          </p>
                        )}
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-muted)" }}>
                          {formatDate(ts)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Contact ── */}
          {(deal.dm_name || deal.dm_email || deal.email || deal.dm_phone) && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
                Contact
              </p>
              <div className="space-y-2">
                {deal.dm_name && (
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{deal.dm_name}</p>
                )}
                {(deal.dm_email ?? deal.email) && (
                  <a
                    href={`mailto:${deal.dm_email ?? deal.email}`}
                    className="text-xs flex items-center gap-1.5"
                    style={{ color: "var(--brand)" }}
                  >
                    <Mail size={11} /> {deal.dm_email ?? deal.email}
                  </a>
                )}
                {deal.dm_phone && (
                  <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--ink-muted)" }}>
                    <Phone size={11} /> {deal.dm_phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Navigation links ── */}
          <div className="space-y-2 pb-8">
            <Link
              href={`/conversations?conv=${deal.id}`}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare size={15} style={{ color: "var(--brand)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Conversation</span>
              </div>
              <ChevronRight size={15} style={{ color: "var(--ink-muted)" }} />
            </Link>
            <Link
              href={`/opportunities/${deal.id}`}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
            >
              <div className="flex items-center gap-2.5">
                <Briefcase size={15} style={{ color: "var(--ink-muted)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Full opportunity record</span>
              </div>
              <ExternalLink size={13} style={{ color: "var(--ink-muted)" }} />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
