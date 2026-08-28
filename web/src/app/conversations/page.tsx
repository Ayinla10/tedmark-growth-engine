import Link from "next/link";
import {
  ArrowLeft, MessageCircle, Mail, ExternalLink, ChevronRight, Clock,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OutreachModal } from "@/components/outreach-modal";
import { ReplyForm } from "@/components/reply-form";
import {
  getConversationList,
  getLeadOutreach,
  getKnowledgeRefs,
  type ConversationItem,
  type OutreachRow,
  type KnowledgeRef,
} from "@/lib/queries";
import { getLeadThread } from "@/lib/mutations";
import { formatDate } from "@/lib/time";

export const dynamic = "force-dynamic";

// ─── helpers ───────────────────────────────────────────────────────────────

type ConvState = "draft" | "replied" | "followup_due" | "waiting";
type FilterKey = "all" | "attention" | "waiting" | "followup" | "interested" | "needs_info";

function convState(item: ConversationItem): ConvState {
  if (item.draft_count > 0) return "draft";
  if (item.reply_at) return "replied";
  if (item.followup_due_at) return "followup_due";
  return "waiting";
}

const STATE_CONFIG: Record<ConvState, { label: string; color: string; bg: string }> = {
  draft:        { label: "Needs approval",  color: "#d97706",          bg: "rgba(245,158,11,0.12)" },
  replied:      { label: "Reply received",  color: "rgb(21 128 61)",   bg: "rgba(34,197,94,0.10)" },
  followup_due: { label: "Follow-up due",   color: "var(--brand)",     bg: "rgba(107,159,255,0.10)" },
  waiting:      { label: "Waiting",         color: "var(--ink-muted)", bg: "var(--surface-2)" },
};

const CLASSIFICATION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  interested:     { label: "Interested",     color: "rgb(21 128 61)",  bg: "rgba(34,197,94,0.10)" },
  needs_info:     { label: "Question",       color: "rgb(37 99 235)",  bg: "rgba(59,130,246,0.10)" },
  not_interested: { label: "Not interested", color: "rgb(185 28 28)",  bg: "rgba(239,68,68,0.10)" },
  out_of_office:  { label: "Out of office",  color: "var(--ink-muted)","bg": "var(--surface-2)" },
  unsubscribe:    { label: "Unsubscribing",  color: "rgb(185 28 28)",  bg: "rgba(239,68,68,0.10)" },
  other:          { label: "Unclear",        color: "var(--ink-muted)","bg": "var(--surface-2)" },
};

function applyFilter(items: ConversationItem[], filter: FilterKey): ConversationItem[] {
  switch (filter) {
    case "attention":  return items.filter(c => { const s = convState(c); return s === "draft" || s === "replied"; });
    case "waiting":    return items.filter(c => convState(c) === "waiting");
    case "followup":   return items.filter(c => convState(c) === "followup_due");
    case "interested": return items.filter(c => c.classification === "interested");
    case "needs_info": return items.filter(c => c.classification === "needs_info");
    default:           return items;
  }
}

function recommendedAction(
  state: ConvState,
  classification: string | null,
): { interpretation: string; action: string } {
  if (state === "draft") return {
    interpretation: "An AI-drafted message is waiting for your review.",
    action: "Approve and send it to start the conversation.",
  };
  if (state === "replied") {
    if (classification === "interested") return {
      interpretation: "They expressed interest in your services.",
      action: "Send a detailed response or prepare a proposal.",
    };
    if (classification === "needs_info") return {
      interpretation: "They have a question that needs answering.",
      action: "Reply with the information they asked for.",
    };
    if (classification === "not_interested") return {
      interpretation: "They declined.",
      action: "Acknowledge politely. Consider archiving if no follow-up needed.",
    };
    if (classification === "out_of_office") return {
      interpretation: "They are currently out of office.",
      action: "Follow up in a few days when they return.",
    };
    return {
      interpretation: "A reply was received.",
      action: "Read and respond to keep the conversation going.",
    };
  }
  if (state === "followup_due") return {
    interpretation: "No reply since the last message.",
    action: "Send a follow-up to re-engage.",
  };
  return {
    interpretation: "Waiting for a reply to your message.",
    action: "Give it a day or two, then consider a follow-up.",
  };
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

// ─── page ──────────────────────────────────────────────────────────────────

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ conv?: string; filter?: string }>;
}) {
  const { conv, filter: filterParam } = await searchParams;
  const filter: FilterKey = (filterParam as FilterKey) || "all";

  const conversations = await getConversationList();

  // Per-conversation data when one is selected
  let thread: Awaited<ReturnType<typeof getLeadThread>> = [];
  let outreachRows: OutreachRow[] = [];
  let selectedConv: ConversationItem | null = null;
  let refsMap = new Map<string, KnowledgeRef>();

  if (conv) {
    selectedConv = conversations.find(c => c.lead_id === conv) ?? null;
    if (selectedConv) {
      [thread, outreachRows] = await Promise.all([
        getLeadThread(conv),
        getLeadOutreach(conv),
      ]);
      const allIds = [...new Set(outreachRows.flatMap(r => r.knowledge_ids))];
      const refs = await getKnowledgeRefs(allIds);
      refsMap = new Map(refs.map(r => [r.id, r]));
    }
  }

  const filtered = applyFilter(conversations, filter);

  const counts: Record<FilterKey, number> = {
    all:        conversations.length,
    attention:  conversations.filter(c => { const s = convState(c); return s === "draft" || s === "replied"; }).length,
    waiting:    conversations.filter(c => convState(c) === "waiting").length,
    followup:   conversations.filter(c => convState(c) === "followup_due").length,
    interested: conversations.filter(c => c.classification === "interested").length,
    needs_info: conversations.filter(c => c.classification === "needs_info").length,
  };

  const ALL_FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all",        label: `All (${counts.all})` },
    { key: "attention",  label: counts.attention > 0 ? `Needs attention · ${counts.attention}` : "Needs attention" },
    { key: "waiting",    label: "Waiting" },
    { key: "followup",   label: "Follow-up due" },
    { key: "interested", label: "Interested" },
    { key: "needs_info", label: "Questions" },
  ];
  const FILTERS = ALL_FILTERS.filter(f => f.key === "all" || f.key === "attention" || counts[f.key] > 0);

  const outreachById = new Map(outreachRows.map(o => [o.id, o]));
  const latestSentOutreachId = [...thread].reverse().find(t => t.kind === "sent")?.id ?? null;

  const state = selectedConv ? convState(selectedConv) : null;
  const stateConf = state ? STATE_CONFIG[state] : null;
  const classConf = selectedConv?.classification ? CLASSIFICATION_CONFIG[selectedConv.classification] : null;
  const recAction = state ? recommendedAction(state, selectedConv?.classification ?? null) : null;

  const convLink = (leadId: string) => `/conversations?conv=${leadId}&filter=${filter}`;
  const filterLink = (f: FilterKey) => conv ? `/conversations?conv=${conv}&filter=${f}` : `/conversations?filter=${f}`;

  return (
    <AppShell>
      <div className="flex" style={{ background: "var(--app-bg)", minHeight: "100vh" }}>

        {/* ══ LEFT — Conversation list ══════════════════════════════════ */}
        <div
          className={conv ? "hidden lg:flex lg:flex-col lg:w-72 lg:flex-shrink-0" : "flex flex-col w-full lg:w-72 lg:flex-shrink-0"}
          style={{ borderRight: "1px solid var(--border-c)", background: "var(--surface)" }}
        >
          {/* Header */}
          <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border-c)" }}>
            <h1 className="text-base font-semibold" style={{ color: "var(--ink)" }}>Conversations</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
              Who is talking to me? What should I do?
            </p>
          </div>

          {/* Filter tabs */}
          <div className="px-2 py-2 border-b flex flex-wrap gap-1.5" style={{ borderColor: "var(--border-c)" }}>
            {FILTERS.map(f => {
              const isActive = filter === f.key;
              return (
                <Link
                  key={f.key}
                  href={filterLink(f.key)}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap"
                  style={{
                    background: isActive ? "var(--brand)" : "var(--surface-2)",
                    color: isActive ? "#fff" : "var(--ink-secondary)",
                  }}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No conversations match this filter.</p>
              </div>
            ) : (
              filtered.map(item => {
                const st = convState(item);
                const stConf = STATE_CONFIG[st];
                const isSelected = item.lead_id === conv;
                const preview = item.reply_at ? item.latest_reply_body : item.latest_body;
                const previewTime = item.reply_at ?? item.sent_at;

                return (
                  <Link
                    key={item.lead_id}
                    href={convLink(item.lead_id)}
                    className="flex items-start gap-3 px-3 py-3 border-b"
                    style={{
                      borderColor: "var(--border-c)",
                      background: isSelected ? "rgba(107,159,255,0.07)" : undefined,
                      borderLeft: isSelected ? "3px solid var(--brand)" : "3px solid transparent",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                      style={{ background: "rgba(107,159,255,0.18)", color: "var(--brand)" }}
                    >
                      {initials(item.business_name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                          {item.business_name}
                        </p>
                        {previewTime && (
                          <p className="text-[11px] flex-shrink-0" style={{ color: "var(--ink-muted)" }}>
                            {formatDate(previewTime)}
                          </p>
                        )}
                      </div>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: stConf.bg, color: stConf.color }}
                      >
                        {stConf.label}
                      </span>
                      {preview && (
                        <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--ink-muted)" }}>
                          {preview}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* ══ CENTER + RIGHT ════════════════════════════════════════════ */}
        <div className={`flex-1 flex min-w-0 ${conv ? "flex" : "hidden lg:flex"}`}>

          {/* CENTER — Thread */}
          <div
            className="flex-1 flex flex-col min-w-0"
            style={{ borderRight: "1px solid var(--border-c)" }}
          >
            {!selectedConv ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <MessageCircle size={32} className="mx-auto mb-3" style={{ color: "var(--ink-muted)", opacity: 0.4 }} />
                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>Select a conversation</p>
                  <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>
                    Pick a lead from the list to view their message thread.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
                  style={{ borderColor: "var(--border-c)", background: "var(--surface)" }}
                >
                  <Link
                    href={`/conversations?filter=${filter}`}
                    className="lg:hidden p-1"
                    style={{ color: "var(--ink-muted)" }}
                    aria-label="Back"
                  >
                    <ArrowLeft size={16} />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {selectedConv.business_name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                      {selectedConv.dm_name ?? selectedConv.dm_email ?? selectedConv.lead_email ?? selectedConv.lead_phone ?? "No contact info"}
                      {selectedConv.pipeline_stage ? ` · ${selectedConv.pipeline_stage}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {stateConf && (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full hidden sm:inline"
                        style={{ background: stateConf.bg, color: stateConf.color }}
                      >
                        {stateConf.label}
                      </span>
                    )}
                    <Link
                      href={`/opportunities/${selectedConv.lead_id}`}
                      className="text-xs flex items-center gap-1 hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      Opportunity <ExternalLink size={10} />
                    </Link>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0 }}>
                  {thread.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No messages in this thread yet.</p>
                    </div>
                  ) : (
                    thread.map(item => {
                      const isReply = item.kind === "reply";
                      const isDraft = item.kind === "draft";
                      const isSent  = item.kind === "sent";
                      const isWhatsApp = item.channel === "whatsapp";
                      const outreachRow = !isReply ? outreachById.get(item.id) : undefined;
                      const msgClassConf = isReply && item.classification
                        ? CLASSIFICATION_CONFIG[item.classification]
                        : null;

                      return (
                        <div key={item.id} className={`flex ${isReply ? "justify-start" : "justify-end"}`}>
                          <div className="max-w-lg w-full">
                            {/* Classification badge */}
                            {msgClassConf && (
                              <div className="flex justify-start mb-1">
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: msgClassConf.bg, color: msgClassConf.color }}
                                >
                                  {msgClassConf.label}
                                </span>
                              </div>
                            )}

                            <div
                              className="rounded-2xl px-4 py-3"
                              style={{
                                background: isReply ? "var(--surface)"
                                  : isDraft ? "var(--surface-2)"
                                  : "var(--brand)",
                                color: isSent ? "#fff" : "var(--ink)",
                                border: isDraft
                                  ? "2px dashed var(--border-c)"
                                  : isReply
                                  ? "1px solid var(--border-c)"
                                  : "none",
                              }}
                            >
                              {/* Draft label + approve button */}
                              {isDraft && (
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#d97706" }}>
                                    Draft — awaiting approval
                                  </p>
                                  {outreachRow && (
                                    <OutreachModal
                                      row={outreachRow}
                                      knowledgeRefs={outreachRow.knowledge_ids
                                        .map(id => refsMap.get(id))
                                        .filter((r): r is KnowledgeRef => r != null)}
                                    />
                                  )}
                                </div>
                              )}

                              {item.subject && (
                                <p className="text-sm font-semibold mb-1">{item.subject}</p>
                              )}
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.body}</p>

                              {/* Footer row */}
                              <div className="flex items-center justify-between mt-2 gap-2">
                                <p
                                  className="text-[11px]"
                                  style={{ color: isSent ? "rgba(255,255,255,0.6)" : "var(--ink-muted)" }}
                                >
                                  {formatDate(item.at)}
                                </p>
                                {!isReply && (
                                  <p
                                    className="text-[10px] flex items-center gap-0.5"
                                    style={{ color: isSent ? "rgba(255,255,255,0.6)" : "var(--ink-muted)" }}
                                  >
                                    {isWhatsApp
                                      ? <><MessageCircle size={9} />&nbsp;WhatsApp</>
                                      : <><Mail size={9} />&nbsp;Email</>
                                    }
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply form */}
                <div
                  className="px-4 py-4 border-t flex-shrink-0"
                  style={{ borderColor: "var(--border-c)", background: "var(--surface)" }}
                >
                  <p className="text-xs mb-2" style={{ color: "var(--ink-muted)" }}>
                    Log a reply they sent you (email or WhatsApp):
                  </p>
                  <ReplyForm
                    leadId={selectedConv.lead_id}
                    latestOutreachId={latestSentOutreachId}
                  />
                </div>
              </>
            )}
          </div>

          {/* RIGHT — Context panel */}
          {selectedConv && (
            <div
              className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 overflow-y-auto p-4 gap-4"
              style={{ background: "var(--app-bg)" }}
            >
              {/* AI interpretation + recommended action */}
              {recAction && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-muted)" }}>
                    AI Interpretation
                  </p>
                  {classConf && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full mb-2 inline-block"
                      style={{ background: classConf.bg, color: classConf.color }}
                    >
                      {classConf.label}
                    </span>
                  )}
                  <p className="text-sm mb-3" style={{ color: "var(--ink-secondary)" }}>
                    {recAction.interpretation}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--ink-muted)" }}>
                    Recommended action
                  </p>
                  <p className="text-sm" style={{ color: "var(--ink)" }}>
                    {recAction.action}
                  </p>
                </div>
              )}

              {/* Follow-up info */}
              {selectedConv.followup_due_at && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: "rgba(107,159,255,0.06)", border: "1px solid rgba(107,159,255,0.20)" }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--brand)" }}>
                    Follow-up queued
                  </p>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock size={12} style={{ color: "var(--brand)" }} />
                    <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>
                      Step {selectedConv.followup_step ?? 1} · due {formatDate(selectedConv.followup_due_at)}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                    No reply since last contact. A follow-up is scheduled.
                  </p>
                </div>
              )}

              {/* Next action */}
              {selectedConv.next_action && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-muted)" }}>
                    Next action
                  </p>
                  <p className="text-sm" style={{ color: "var(--ink)" }}>{selectedConv.next_action}</p>
                  {selectedConv.next_action_due && (
                    <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>
                      Due {formatDate(selectedConv.next_action_due)}
                    </p>
                  )}
                </div>
              )}

              {/* Contact info */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>
                  Contact
                </p>
                <div className="space-y-2.5">
                  {selectedConv.dm_name && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Decision-maker</p>
                      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{selectedConv.dm_name}</p>
                    </div>
                  )}
                  {(selectedConv.dm_email ?? selectedConv.lead_email) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Email</p>
                      <p className="text-xs" style={{ color: "var(--ink)" }}>
                        {selectedConv.dm_email ?? selectedConv.lead_email}
                      </p>
                    </div>
                  )}
                  {(selectedConv.dm_phone ?? selectedConv.lead_phone) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Phone</p>
                      <p className="text-xs" style={{ color: "var(--ink)" }}>
                        {selectedConv.dm_phone ?? selectedConv.lead_phone}
                      </p>
                    </div>
                  )}
                  {!selectedConv.dm_name && !selectedConv.dm_email && !selectedConv.lead_email && !selectedConv.dm_phone && !selectedConv.lead_phone && (
                    <p className="text-xs" style={{ color: "var(--ink-muted)" }}>No contact info on file.</p>
                  )}
                </div>
              </div>

              {/* View opportunity */}
              <Link
                href={`/opportunities/${selectedConv.lead_id}`}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border-c)", color: "var(--brand)" }}
              >
                <span className="text-sm font-semibold">View full opportunity</span>
                <ChevronRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
