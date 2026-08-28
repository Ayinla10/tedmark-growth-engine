import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin, ArrowLeft, CheckCircle2, AlertTriangle, Clock, MessageCircle, Mail } from "lucide-react";
import { StageSwitcher } from "@/components/stage-switcher";

/* ── Phone helper (mirrors backend tools/contactFinder.js + tools/countries.js) ── */
const MOBILE_PREFIXES: Record<string, string[]> = {
  GH: ['20','23','24','25','26','27','28','50','53','54','55','56','57','59'],
  NG: ['70','71','80','81','90','91'],
  KE: ['70','71','72','74','75','76','77','78','79','10','11'],
  CI: ['01','05','07'],
  SN: ['70','75','76','77','78'],
};
const CALLING_CODE: Record<string, string> = { GH:'233', NG:'234', KE:'254', CI:'225', SN:'221' };

function detectPhone(raw: string | null, country: string): { isMobile: boolean; waLink: string } | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  const cc = CALLING_CODE[country?.toUpperCase()] ?? '233';
  const prefixes = MOBILE_PREFIXES[country?.toUpperCase()] ?? MOBILE_PREFIXES.GH;
  // strip calling code if present
  const nsn = digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  const isMobile = prefixes.includes(nsn.slice(0, 2));
  return { isMobile, waLink: `https://wa.me/${cc}${nsn}` };
}
import { AppShell } from "@/components/app-shell";
import { LeadRowActions } from "@/components/lead-row-actions";
import { ProposalModal } from "@/components/proposal-modal";
import { ReplyForm } from "@/components/reply-form";
import { getLeadThread } from "@/lib/mutations";
import { getLeadDetail } from "@/lib/queries";
import { googleMapsSearchUrl, googleSearchUrl } from "@/lib/googleLinks";
import { formatDate } from "@/lib/time";
import type { SiteSignals } from "@/lib/queries";

export const dynamic = "force-dynamic";

/* ── Strength label ──────────────────────────────────────────────────── */
function strengthConfig(score: number | null) {
  if (score == null) return { label: "Not yet assessed", color: "var(--ink-muted)", bg: "var(--surface-2)", border: "var(--border-c)" };
  if (score >= 8) return { label: "Strong opportunity", color: "rgb(21 128 61)", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)" };
  if (score >= 6) return { label: "Good opportunity",   color: "rgb(133 77 14)",  bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" };
  if (score >= 4) return { label: "Possible opportunity",color: "rgb(59 130 246)",bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)" };
  return { label: "Low priority", color: "var(--ink-muted)", bg: "var(--surface-2)", border: "var(--border-c)" };
}

/* ── Pipeline stage chip ─────────────────────────────────────────────── */
const STAGE_COLOR: Record<string, string> = {
  New: "#6b9fff", Contacted: "#b45309", Qualified: "#065f46",
  "Proposal Sent": "#92400e", Negotiating: "#5b21b6", Won: "#14532d", Lost: "#991b1b",
};
const STAGE_BG: Record<string, string> = {
  New: "rgba(107,159,255,0.12)", Contacted: "rgba(251,191,36,0.12)",
  Qualified: "rgba(52,211,153,0.12)", "Proposal Sent": "rgba(245,158,11,0.12)",
  Negotiating: "rgba(167,139,250,0.12)", Won: "rgba(34,197,94,0.12)", Lost: "rgba(239,68,68,0.10)",
};

function StagePill({ stage }: { stage: string }) {
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: STAGE_BG[stage] ?? "var(--surface-2)", color: STAGE_COLOR[stage] ?? "var(--ink-muted)" }}
    >
      {stage}
    </span>
  );
}

/* ── Info row ────────────────────────────────────────────────────────── */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2" style={{ borderBottom: "1px solid var(--border-c)" }}>
      <span className="text-xs shrink-0 pt-0.5" style={{ color: "var(--ink-muted)" }}>{label}</span>
      <span className="text-sm text-right" style={{ color: "var(--ink)" }}>{children}</span>
    </div>
  );
}

/* ── Section heading ─────────────────────────────────────────────────── */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: "var(--ink-muted)" }}>
      {children}
    </p>
  );
}

/* ── Card wrapper ────────────────────────────────────────────────────── */
function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-5 mb-4 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
    >
      {children}
    </div>
  );
}

/* ── Site signal list ─────────────────────────────────────────────────── */
function siteSignalLines(sig: SiteSignals): { text: string; good: boolean }[] {
  const lines: { text: string; good: boolean }[] = [];
  if (sig.looksOutdated) lines.push({ text: "Website looks outdated", good: false });
  if (!sig.mobileFriendly) lines.push({ text: "Not mobile-friendly", good: false });
  if (!sig.hasH1 || !sig.hasMetaDescription) lines.push({ text: "Weak basic SEO", good: false });
  if (!sig.hasTrackingPixel) lines.push({ text: "No analytics/tracking installed", good: false });
  if (!sig.hasClearCta) lines.push({ text: "No clear call-to-action", good: false });
  if (!sig.hasBookingSystem) lines.push({ text: "No booking or scheduling system", good: false });
  if (!sig.hasEmailCapture) lines.push({ text: "No email capture / lead form", good: false });
  if (sig.hasSsl === false) lines.push({ text: "No SSL / HTTPS", good: false });
  if (sig.mobileFriendly) lines.push({ text: "Mobile-friendly", good: true });
  if (sig.hasBookingSystem) lines.push({ text: "Has booking system", good: true });
  if (sig.hasEcommerce) lines.push({ text: "Online ordering / e-commerce", good: true });
  if (sig.hasBlog) lines.push({ text: "Has blog or news section", good: true });
  return lines;
}

/* ── Classification labels ───────────────────────────────────────────── */
const CLASSIFICATION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  interested:     { label: "Interested",     color: "rgb(21 128 61)",  bg: "rgba(34,197,94,0.10)" },
  needs_info:     { label: "Needs info",     color: "rgb(37 99 235)",  bg: "rgba(59,130,246,0.10)" },
  not_interested: { label: "Not interested", color: "var(--ink-muted)", bg: "var(--surface-2)" },
  out_of_office:  { label: "Out of office",  color: "var(--ink-muted)", bg: "var(--surface-2)" },
  unsubscribe:    { label: "Unsubscribe",    color: "rgb(185 28 28)",  bg: "rgba(239,68,68,0.10)" },
  other:          { label: "Other",          color: "var(--ink-muted)", bg: "var(--surface-2)" },
};

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead, proposals }, thread] = await Promise.all([
    getLeadDetail(id),
    getLeadThread(id),
  ]);

  if (!lead) notFound();

  const strength = strengthConfig(lead.score);
  const latestSentOutreachId = [...thread].reverse().find((t) => t.kind === "sent")?.id ?? null;

  /* ── Primary actions ─────────────────────────────────────────────── */
  const hasDraft = thread.some((t) => t.kind === "draft");
  const hasReply = thread.some((t) => t.kind === "reply");
  const hasOutreach = thread.some((t) => t.kind === "sent");

  /* ── Next best action ────────────────────────────────────────────── */
  let nextAction: { label: string; why: string; type: "info" | "warn" } | null = null;
  if (hasDraft) {
    nextAction = { label: "Review and approve the drafted message before it can be sent.", why: "A personalised message is ready — approve it from the conversation.", type: "info" };
  } else if (hasReply) {
    nextAction = { label: "A reply has been received — respond to keep the conversation warm.", why: "Timely responses significantly increase conversion rates.", type: "warn" };
  } else if (!hasOutreach) {
    nextAction = { label: "No outreach has been sent yet.", why: "Generate a personalised message to start the conversation.", type: "info" };
  } else if (lead.next_action) {
    nextAction = { label: lead.next_action, why: lead.next_action_due ? `Due ${lead.next_action_due}` : "", type: "info" };
  }

  /* ── Service list ────────────────────────────────────────────────── */
  const services = lead.recommended_services?.length ? lead.recommended_services : lead.recommended_service ? [lead.recommended_service] : [];

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl" style={{ background: "var(--app-bg)", minHeight: "100vh" }}>

        {/* Back */}
        <Link
          href="/opportunities"
          className="inline-flex items-center gap-1.5 text-sm mb-4"
          style={{ color: "var(--ink-muted)" }}
        >
          <ArrowLeft size={14} /> All opportunities
        </Link>

        {/* ═══ DRAFT APPROVAL BANNER ══════════════════════════════════ */}
        {hasDraft && (
          <div
            className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3"
            style={{ background: "rgba(245,158,11,0.08)", border: "2px solid rgba(245,158,11,0.35)" }}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={16} style={{ color: "#d97706", flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#92400e" }}>Draft message waiting for approval</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-secondary)" }}>A personalised message is ready — review and approve it before it can be sent.</p>
              </div>
            </div>
            <Link
              href="/conversations"
              className="text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
              style={{ background: "rgba(245,158,11,0.20)", color: "#b45309" }}
            >
              Approve draft →
            </Link>
          </div>
        )}

        {/* ═══ HERO ════════════════════════════════════════════════════ */}
        <div
          className="rounded-xl p-5 mb-4"
          style={{
            background: "var(--surface)",
            border: `1px solid ${strength.border}`,
            borderLeft: `3px solid ${strength.color}`,
          }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold leading-tight" style={{ color: "var(--ink)" }}>
                {lead.business_name}
              </h1>
              <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: "var(--ink-muted)" }}>
                <MapPin size={12} />
                {[lead.location, lead.sector].filter(Boolean).join(" · ")}
              </p>
            </div>
            <StageSwitcher leadId={lead.id} currentStage={lead.pipeline_stage} />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <span
              className="text-sm font-semibold px-3 py-1 rounded-full"
              style={{ background: strength.bg, color: strength.color, border: `1px solid ${strength.border}` }}
            >
              {strength.label}
            </span>
            {lead.score != null && (
              <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                Score {lead.score}/10
              </span>
            )}
          </div>

          {/* Primary actions */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {/* Always show Generate outreach / draft action */}
            <LeadRowActions
              leadId={lead.id}
              showGenerateOutreach
              showEnrich={!lead.score}
              showDmEnrich={!lead.dm_name}
              showIcpScore={lead.icp_total === null}
              showQualify={lead.status === "raw"}
              showArchive={lead.status !== "archived"}
            />
            {proposals.length > 0 && (
              <Link
                href="#proposals"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}
              >
                View proposal →
              </Link>
            )}
            {thread.length > 0 && (
              <Link
                href="#conversation"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "var(--surface-2)", color: "var(--ink-secondary)", border: "1px solid var(--border-c)" }}
              >
                View conversation →
              </Link>
            )}
          </div>
        </div>

        {/* ═══ NEXT BEST ACTION ════════════════════════════════════════ */}
        {nextAction && (
          <div
            className="rounded-xl px-4 py-3 mb-4 flex items-start gap-3"
            style={{
              background: nextAction.type === "warn" ? "rgba(245,158,11,0.06)" : "rgba(107,159,255,0.06)",
              border: `1px solid ${nextAction.type === "warn" ? "rgba(245,158,11,0.25)" : "rgba(107,159,255,0.20)"}`,
            }}
          >
            {nextAction.type === "warn"
              ? <AlertTriangle size={15} style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }} />
              : <Clock size={15} style={{ color: "var(--brand)", flexShrink: 0, marginTop: 1 }} />
            }
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Next step</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--ink-secondary)" }}>{nextAction.label}</p>
              {nextAction.why && (
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>{nextAction.why}</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* ═══ COL 1+2 — Main content ═══════════════════════════════ */}
          <div className="lg:col-span-2 space-y-4">

            {/* WHY THIS IS AN OPPORTUNITY */}
            {(lead.score_reason || lead.problems?.length > 0) && (
              <SectionCard>
                <SectionHeading>Why this is an opportunity</SectionHeading>
                {lead.score_reason && (
                  <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--ink-secondary)" }}>
                    {lead.score_reason}
                  </p>
                )}
                {lead.problems?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>Problems identified:</p>
                    {lead.problems.map((p: string, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs font-bold mt-0.5" style={{ color: "#ef4444", flexShrink: 0 }}>✕</span>
                        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>{p}</p>
                      </div>
                    ))}
                  </div>
                )}
                {lead.icp_reasoning && (
                  <p className="text-sm mt-3 pt-3 leading-relaxed" style={{ color: "var(--ink-secondary)", borderTop: "1px solid var(--border-c)" }}>
                    {lead.icp_reasoning}
                  </p>
                )}
              </SectionCard>
            )}

            {/* RECOMMENDED SERVICE */}
            {services.length > 0 && (
              <SectionCard>
                <SectionHeading>Recommended Tedmark service</SectionHeading>
                <div className="flex flex-wrap gap-2 mb-3">
                  {services.map((s: string) => (
                    <span
                      key={s}
                      className="text-sm font-semibold px-3 py-1.5 rounded-lg capitalize"
                      style={{ background: "var(--brand)", color: "#fff" }}
                    >
                      {s.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
                {lead.site_signals && services.length > 0 && (
                  <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
                    {lead.site_signals.looksOutdated && "Website appears outdated. "}
                    {!lead.site_signals.mobileFriendly && "Not optimised for mobile. "}
                    {!lead.site_signals.hasH1 && "Missing basic SEO elements."}
                  </p>
                )}
              </SectionCard>
            )}

            {/* WEBSITE INTELLIGENCE — always shown */}
            <SectionCard>
              <div className="flex items-center justify-between mb-3">
                <SectionHeading>Digital presence assessment</SectionHeading>
                {lead.enriched_at && (
                  <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
                    Scanned {formatDate(lead.enriched_at)}
                  </span>
                )}
              </div>
              {lead.site_signals ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {siteSignalLines(lead.site_signals).map(({ text, good }) => (
                      <div key={text} className="flex items-center gap-2">
                        {good
                          ? <CheckCircle2 size={13} style={{ color: "#22c55e", flexShrink: 0 }} />
                          : <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>✕</span>
                        }
                        <p className="text-xs" style={{ color: good ? "var(--ink-secondary)" : "var(--ink)" }}>{text}</p>
                      </div>
                    ))}
                  </div>
                  {lead.site_signals.cms && (
                    <p className="text-xs mt-2 pt-2" style={{ color: "var(--ink-muted)", borderTop: "1px solid var(--border-c)" }}>
                      Built with: {lead.site_signals.cms}
                      {lead.site_signals.copyrightYear ? ` · Copyright ${lead.site_signals.copyrightYear}` : ""}
                    </p>
                  )}
                </>
              ) : lead.website_url ? (
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  Not yet scanned.{" "}
                  {!lead.enriched_at
                    ? "Use the Research action to analyse this business's website for digital gaps and opportunities."
                    : "Research ran but no website data was found — the site may be unreachable."}
                </p>
              ) : (
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  No website found for this business — digital assessment not available.
                </p>
              )}
            </SectionCard>

            {/* WHAT HAPPENED — timeline */}
            <SectionCard>
              <SectionHeading>What happened</SectionHeading>
              {thread.length === 0 && proposals.length === 0 ? (
                <div>
                  <p className="text-sm mb-3" style={{ color: "var(--ink-muted)" }}>
                    No outreach has been sent yet.
                  </p>
                  <div
                    className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                    style={{ background: "rgba(107,159,255,0.06)", border: "1px solid rgba(107,159,255,0.20)" }}
                  >
                    <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
                      Generate a personalised message to start the conversation.
                    </p>
                    <LeadRowActions leadId={lead.id} showGenerateOutreach showQualify={lead.status === "raw"} showEnrich={false} showArchive={false} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Discovery event */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold"
                      style={{ background: "var(--surface-2)", color: "var(--ink-muted)", border: "1px solid var(--border-c)" }}
                    >
                      D
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>Business discovered</p>
                      <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{formatDate(lead.created_at)} · via {lead.source === "maps" ? "Google Maps" : lead.source}</p>
                    </div>
                  </div>
                  {lead.score != null && (
                    <div className="flex items-start gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold"
                        style={{ background: "var(--surface-2)", color: "var(--ink-muted)", border: "1px solid var(--border-c)" }}
                      >
                        R
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>Researched and scored</p>
                        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Score {lead.score}/10</p>
                      </div>
                    </div>
                  )}
                  {thread.map((item) => {
                    const isWhatsApp = item.channel === "whatsapp";
                    const kindLabel =
                      item.kind === "sent"
                        ? isWhatsApp ? "Sent via WhatsApp" : "Sent via email"
                        : item.kind === "draft"
                        ? isWhatsApp ? "Draft (WhatsApp)" : "Draft (email)"
                        : "Reply received";
                    const dotColor = item.kind === "reply" ? "#22c55e" : item.kind === "draft" ? "#f59e0b" : isWhatsApp ? "#22c55e" : "var(--brand)";
                    const DotIcon = item.kind === "reply" ? null : item.channel === "whatsapp" ? MessageCircle : item.kind !== "draft" ? Mail : null;
                    const dotLetter = item.kind === "reply" ? "R" : item.kind === "draft" && !isWhatsApp ? "D" : null;
                    return (
                      <div key={item.id} className="flex items-start gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${dotColor}20`, color: dotColor, border: `1px solid ${dotColor}40` }}
                        >
                          {DotIcon
                            ? <DotIcon size={11} />
                            : <span className="text-[9px] font-bold">{dotLetter ?? "→"}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>{kindLabel}</p>
                            {item.classification && CLASSIFICATION_LABELS[item.classification] && (
                              <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{
                                  background: CLASSIFICATION_LABELS[item.classification].bg,
                                  color: CLASSIFICATION_LABELS[item.classification].color,
                                }}
                              >
                                {CLASSIFICATION_LABELS[item.classification].label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5 line-clamp-2 pr-4" style={{ color: "var(--ink-muted)" }}>{item.body}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-muted)" }}>{formatDate(item.at)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {proposals.map((p) => (
                    <div key={p.id} className="flex items-start gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold"
                        style={{ background: "rgba(245,158,11,0.15)", color: "#d97706", border: "1px solid rgba(245,158,11,0.3)" }}
                      >
                        P
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>Proposal prepared</p>
                        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                          {p.services?.join(", ")} · {p.budget_range ?? "no budget set"} · {formatDate(p.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA after timeline */}
              {(thread.length > 0 || proposals.length > 0) && (() => {
                const lastThreadItem = thread[thread.length - 1];
                if (hasDraft) return (
                  <div className="mt-3 rounded-lg px-4 py-3 flex items-center justify-between gap-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.20)" }}>
                    <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>A draft message is ready — approve it to send.</p>
                    <Link href="/conversations" className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap" style={{ background: "rgba(245,158,11,0.15)", color: "#b45309" }}>Approve draft →</Link>
                  </div>
                );
                if (hasReply) return (
                  <div className="mt-3 rounded-lg px-4 py-3 flex items-center justify-between gap-3" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.20)" }}>
                    <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>They replied — log your response to keep the record complete.</p>
                    <span className="text-xs" style={{ color: "var(--ink-muted)" }}>↓ use the reply box below</span>
                  </div>
                );
                if (hasOutreach && !lastThreadItem) return null;
                if (hasOutreach) return (
                  <div className="mt-3 rounded-lg px-4 py-3 flex items-center justify-between gap-3" style={{ background: "rgba(107,159,255,0.06)", border: "1px solid rgba(107,159,255,0.15)" }}>
                    <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>No reply yet. Follow up or log a reply if they reached out directly.</p>
                    <LeadRowActions leadId={lead.id} showGenerateOutreach showEnrich={false} showArchive={false} />
                  </div>
                );
                return null;
              })()}

              {/* Conversation thread (full) */}
              {thread.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-c)" }}>
                  <p className="text-xs font-medium mb-3" style={{ color: "var(--ink-muted)" }}>Full conversation</p>
                  <div className="space-y-3">
                    {thread.map((item) => (
                      <div key={item.id} className={`flex ${item.kind === "reply" ? "justify-start" : "justify-end"}`}>
                        <div
                          className="max-w-sm rounded-2xl px-4 py-2.5 text-sm"
                          style={{
                            background:
                              item.kind === "sent"
                                ? "var(--brand)"
                                : item.kind === "draft"
                                ? "var(--surface-2)"
                                : "var(--surface-2)",
                            color: item.kind === "sent" ? "#fff" : "var(--ink)",
                            border: item.kind === "draft" ? "2px dashed var(--border-c)" : "none",
                          }}
                        >
                          {item.kind === "draft" && (
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#d97706" }}>
                              Draft — not sent yet
                            </p>
                          )}
                          {item.subject && <p className="font-semibold mb-1">{item.subject}</p>}
                          <p className="whitespace-pre-wrap text-xs leading-relaxed">{item.body}</p>
                          <p className="text-[11px] mt-1" style={{ color: item.kind === "sent" ? "rgba(255,255,255,0.7)" : "var(--ink-muted)" }}>
                            {formatDate(item.at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <ReplyForm leadId={lead.id} latestOutreachId={latestSentOutreachId} />
                    <p className="text-xs mt-2" style={{ color: "var(--ink-muted)" }}>
                      Log replies manually — no automatic inbox sync yet.
                    </p>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* PROPOSALS */}
            {proposals.length > 0 && (
              <SectionCard>
                <SectionHeading>Proposals</SectionHeading>
                <div className="space-y-2">
                  {proposals.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div>
                        <p className="text-sm font-medium capitalize" style={{ color: "var(--ink)" }}>
                          {p.services?.join(", ") ?? "—"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                          {p.budget_range ?? "No budget"} · {formatDate(p.created_at)}
                        </p>
                      </div>
                      <ProposalModal row={{ ...p, business_name: lead.business_name, lead_email: lead.email }} />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          {/* ═══ COL 3 — Sidebar ═════════════════════════════════════ */}
          <div className="space-y-4">

            {/* BUSINESS */}
            <SectionCard>
              <div className="flex items-center justify-between mb-3">
                <SectionHeading>Business</SectionHeading>
                {lead.enriched_at && (
                  <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
                    Researched {formatDate(lead.enriched_at)}
                  </span>
                )}
              </div>
              <div className="space-y-0">
                <InfoRow label="Website">
                  {lead.website_url ? (
                    <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm hover:underline" style={{ color: "var(--brand)" }}>
                      Visit <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span style={{ color: "var(--ink-muted)" }}>
                      {lead.enriched_at ? "None found" : "Not yet searched"}
                    </span>
                  )}
                </InfoRow>
                <InfoRow label="Location">{lead.location ?? "—"}</InfoRow>
                <InfoRow label="Country">{lead.country}</InfoRow>
                <InfoRow label="Sector"><span className="capitalize">{lead.sector ?? "—"}</span></InfoRow>
                <InfoRow label="Phone">
                  {(() => {
                    const phoneInfo = detectPhone(lead.phone, lead.country);
                    if (!lead.phone) {
                      return (
                        <span style={{ color: "var(--ink-muted)" }}>
                          {lead.enriched_at ? "None found" : "Not yet searched"}
                        </span>
                      );
                    }
                    if (!phoneInfo) return lead.phone;
                    return (
                      <span className="flex items-center gap-2 flex-wrap justify-end">
                        <span>{lead.phone}</span>
                        {phoneInfo.isMobile ? (
                          <a
                            href={phoneInfo.waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(34,197,94,0.12)", color: "rgb(21 128 61)" }}
                          >
                            <MessageCircle size={10} /> WhatsApp
                          </a>
                        ) : (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{ background: "var(--surface-2)", color: "var(--ink-muted)" }}
                          >
                            Landline
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </InfoRow>
                <InfoRow label="Email">
                  {lead.email ? (
                    lead.email
                  ) : (
                    <span style={{ color: "var(--ink-muted)" }}>
                      {lead.enriched_at ? "None found" : "Not yet searched"}
                    </span>
                  )}
                </InfoRow>
                {lead.social_url && (
                  <InfoRow label="Social">
                    <a href={lead.social_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: "var(--brand)" }}>
                      Profile <ExternalLink size={11} />
                    </a>
                  </InfoRow>
                )}
                <InfoRow label="Found">
                  {formatDate(lead.created_at)} via {lead.source === "maps" ? "Google Maps" : lead.source}
                </InfoRow>
              </div>
              {!lead.enriched_at && (
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-c)" }}>
                  <p className="text-xs mb-2" style={{ color: "var(--ink-muted)" }}>
                    Contact details not yet researched — only the phone number from Google Maps is available.
                  </p>
                  <LeadRowActions leadId={lead.id} showEnrich showArchive={false} />
                </div>
              )}
              <div className="flex flex-col gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid var(--border-c)" }}>
                <a href={googleMapsSearchUrl(lead.business_name, lead.location)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--brand)" }}>
                  <MapPin size={12} /> View on Google Maps
                </a>
                <a href={googleSearchUrl(lead.business_name, lead.location)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--brand)" }}>
                  <ExternalLink size={12} /> Search on Google
                </a>
              </div>
            </SectionCard>

            {/* DECISION-MAKER */}
            {lead.dm_name ? (
              <SectionCard>
                <SectionHeading>Decision-maker</SectionHeading>
                <div className="space-y-0">
                  <InfoRow label="Name"><span className="font-medium">{lead.dm_name}</span></InfoRow>
                  {lead.dm_title && <InfoRow label="Title">{lead.dm_title}</InfoRow>}
                  <InfoRow label="Email">{lead.dm_email ?? "—"}</InfoRow>
                  <InfoRow label="Phone">{lead.dm_phone ?? "—"}</InfoRow>
                  {lead.dm_linkedin_url && (
                    <InfoRow label="LinkedIn">
                      <a href={lead.dm_linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: "var(--brand)" }}>
                        Profile <ExternalLink size={11} />
                      </a>
                    </InfoRow>
                  )}
                </div>
              </SectionCard>
            ) : (
              <SectionCard>
                <SectionHeading>Decision-maker</SectionHeading>
                {lead.dm_enriched_at ? (
                  <>
                    <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>
                      No decision-maker found.
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                      We searched {lead.website_url ? "the website" : "available sources"} on {formatDate(lead.dm_enriched_at)} and could not find a named contact — the site may not publish staff information.
                      {lead.email || lead.phone ? " Contact details for the business are in the Business section above." : ""}
                    </p>
                  </>
                ) : lead.website_url ? (
                  <>
                    <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>
                      Not yet searched.
                    </p>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--ink-muted)" }}>
                      We have not yet searched for a decision-maker at this business. Use Find DM to scan their website for a contact name, title, and email.
                    </p>
                    <LeadRowActions leadId={lead.id} showDmEnrich showEnrich={false} showArchive={false} />
                  </>
                ) : (
                  <>
                    <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>
                      No website to search.
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                      This business has no website, so we cannot search for a named decision-maker automatically.
                      {lead.phone ? " You may be able to reach someone directly on the phone number listed above." : " No contact details are available — try Google or their social media."}
                    </p>
                  </>
                )}
              </SectionCard>
            )}

            {/* ICP SCORE — if available */}
            {lead.icp_total !== null && (() => {
              const dims = [
                { label: "Budget",    value: lead.icp_budget },
                { label: "Authority", value: lead.icp_authority },
                { label: "Need",      value: lead.icp_need },
                { label: "Urgency",   value: lead.icp_urgency },
                { label: "Fit",       value: lead.icp_fit },
              ];
              const allZero = dims.every((d) => (d.value ?? 0) === 0);
              return (
                <SectionCard>
                  <SectionHeading>Sales readiness</SectionHeading>
                  {allZero ? (
                    <div>
                      <p className="text-sm mb-1" style={{ color: "var(--ink-secondary)" }}>ICP score was run but returned no signal.</p>
                      <p className="text-xs" style={{ color: "var(--ink-muted)" }}>This usually means not enough website data was found to assess budget, authority, need, urgency, or fit. Enriching the business first may improve the score.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>Overall</p>
                        <span
                          className="text-sm font-semibold px-2.5 py-0.5 rounded-full"
                          style={{ background: "rgba(107,159,255,0.12)", color: "var(--brand)" }}
                        >
                          {lead.icp_total}/25
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1 mb-2">
                        {dims.map(({ label, value }) => (
                          <div key={label} className="text-center">
                            <p className="text-[10px]" style={{ color: "var(--ink-muted)" }}>{label}</p>
                            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{value ?? "—"}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </SectionCard>
              );
            })()}

          </div>
        </div>

      </div>
    </AppShell>
  );
}
