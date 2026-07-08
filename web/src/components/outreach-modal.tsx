"use client";

import { MessageCircle, Pencil, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { approveOutreachAction, editOutreachAction, markWhatsappSentAction, sendOutreachAction } from "@/lib/actions";
import { Modal, ResultBanner } from "./modal";
import { StatusBadge } from "./ui";

export type OutreachPreviewData = {
  id: string;
  business_name: string;
  subject: string | null;
  body: string;
  status: string;
  message_type: string;
  lead_email: string | null;
  lead_phone: string | null;
};

function waLink(phone: string, body: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(body)}`;
}

export function OutreachModal({ row }: { row: OutreachPreviewData }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(row.subject ?? "");
  const [body, setBody] = useState(row.body);
  const [toEmail, setToEmail] = useState(row.lead_email ?? "");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; output?: string } | null>(null);

  const isWhatsapp = row.message_type === "whatsapp";
  const canEdit = row.status !== "sent";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-brand hover:underline text-sm">
        Preview
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Outreach — ${row.business_name}`} wide>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={row.status} />
            {isWhatsapp ? (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 flex items-center gap-1">
                <MessageCircle size={11} /> WhatsApp
              </span>
            ) : (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-surface-2 text-ink-secondary">Email</span>
            )}
          </div>
          {canEdit && !editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs flex items-center gap-1 text-ink-secondary hover:text-brand"
            >
              <Pencil size={13} /> Edit
            </button>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-3">
            {!isWhatsapp && (
              <div>
                <label className="text-xs text-ink-secondary block mb-1">Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full" />
              </div>
            )}
            <div>
              <label className="text-xs text-ink-secondary block mb-1">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="w-full text-sm p-3 rounded-lg border border-border-c bg-surface-2 resize-y"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                className="bg-brand text-white px-3 py-1.5 rounded-lg text-sm"
                onClick={() =>
                  startTransition(async () => {
                    const r = await editOutreachAction(row.id, isWhatsapp ? "" : subject, body);
                    setResult({ ok: r.ok, output: r.ok ? "Saved." : "Could not save — already sent?" });
                    if (r.ok) setEditing(false);
                  })
                }
              >
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-surface-2 rounded-xl p-4">
            {!isWhatsapp && subject ? <p className="text-sm font-semibold text-ink mb-2">{subject}</p> : null}
            <p className="text-sm text-ink-secondary whitespace-pre-wrap">{body}</p>
          </div>
        )}

        {result ? <ResultBanner ok={result.ok} output={result.output ?? ""} /> : null}

        {!editing && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-c">
            {row.status === "draft" && (
              <button
                type="button"
                disabled={pending}
                className="bg-brand text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                onClick={() =>
                  startTransition(async () => {
                    const r = await approveOutreachAction(row.id);
                    setResult({ ok: r.ok, output: r.ok ? "Approved. Ready to send." : "Could not approve." });
                  })
                }
              >
                Approve
              </button>
            )}

            {row.status === "approved" && isWhatsapp && (
              row.lead_phone ? (
                <button
                  type="button"
                  disabled={pending}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 disabled:opacity-60"
                  onClick={() =>
                    startTransition(async () => {
                      window.open(waLink(row.lead_phone as string, row.body), "_blank", "noopener,noreferrer");
                      const r = await markWhatsappSentAction(row.id);
                      setResult({
                        ok: r.ok,
                        output: r.ok
                          ? "Opened WhatsApp with the message pre-filled — press send there too. Marked as sent here."
                          : "Could not mark as sent.",
                      });
                    })
                  }
                >
                  <MessageCircle size={13} /> Send via WhatsApp
                </button>
              ) : (
                <p className="text-xs text-ink-muted">No phone number on file for this lead.</p>
              )
            )}

            {row.status === "approved" && !isWhatsapp && (
              <>
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="text-sm"
                />
                <button
                  type="button"
                  disabled={pending || !toEmail}
                  className="bg-brand text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 disabled:opacity-60"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await sendOutreachAction(row.id, toEmail);
                      setResult(r);
                    })
                  }
                >
                  <Send size={13} /> Send
                </button>
              </>
            )}

            {row.status === "sent" && <p className="text-xs text-ink-muted">Already sent — no further edits.</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
