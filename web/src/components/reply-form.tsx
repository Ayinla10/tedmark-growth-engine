"use client";

import { Mail, MessageSquare, Send, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { logReplyAction, sendDirectReplyAction } from "@/lib/actions";

type Props = {
  leadId: string;
  latestOutreachId: string | null;
  toEmail: string | null;
  reSubject: string | null;
};

type Tab = "send" | "log";

export function ReplyForm({ leadId, latestOutreachId, toEmail, reSubject }: Props) {
  const [tab, setTab] = useState<Tab>(toEmail ? "send" : "log");
  const [subject, setSubject] = useState(reSubject ?? "");
  const [body, setBody] = useState("");
  const [logBody, setLogBody] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setBody("");
    setLogBody("");
    setStatus("idle");
    setErrorMsg("");
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !toEmail) return;
    setStatus("idle");
    startTransition(async () => {
      const result = await sendDirectReplyAction(leadId, toEmail, subject.trim() || "Re: your message", body.trim());
      if (result.ok) {
        setBody("");
        setStatus("ok");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setErrorMsg(result.error ?? "Failed to send.");
        setStatus("error");
      }
    });
  }

  function handleLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logBody.trim()) return;
    startTransition(async () => {
      await logReplyAction(leadId, latestOutreachId, logBody.trim());
      setLogBody("");
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    });
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border-c)", background: "var(--surface)" }}
    >
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--border-c)" }}>
        <button
          type="button"
          onClick={() => { setTab("send"); reset(); }}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 transition-colors"
          style={{
            color: tab === "send" ? "var(--brand)" : "var(--ink-muted)",
            borderBottom: tab === "send" ? "2px solid var(--brand)" : "2px solid transparent",
            background: "transparent",
          }}
        >
          <Mail size={13} />
          Send reply
        </button>
        <button
          type="button"
          onClick={() => { setTab("log"); reset(); }}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 transition-colors"
          style={{
            color: tab === "log" ? "var(--brand)" : "var(--ink-muted)",
            borderBottom: tab === "log" ? "2px solid var(--brand)" : "2px solid transparent",
            background: "transparent",
          }}
        >
          <MessageSquare size={13} />
          Log inbound
        </button>
      </div>

      {/* Send panel */}
      {tab === "send" && (
        <form onSubmit={handleSend} className="p-3 space-y-2">
          {!toEmail && (
            <p className="text-xs px-1" style={{ color: "#d97706" }}>
              No email address on file for this lead — add one in the opportunity to enable sending.
            </p>
          )}
          {toEmail && (
            <p className="text-[11px] px-1" style={{ color: "var(--ink-muted)" }}>
              To: <span style={{ color: "var(--ink)" }}>{toEmail}</span>
            </p>
          )}
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full text-sm px-3 py-2 rounded-lg border"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-c)",
              color: "var(--ink)",
              outline: "none",
            }}
          />
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={toEmail ? "Type your reply…" : "No email on file."}
              disabled={!toEmail}
              rows={3}
              className="flex-1 text-sm px-3 py-2 rounded-lg border resize-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-c)",
                color: "var(--ink)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={pending || !body.trim() || !toEmail}
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg disabled:opacity-50 transition-opacity"
              style={{ background: "var(--brand)", color: "#fff" }}
              aria-label="Send"
            >
              {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          {status === "ok" && (
            <p className="text-xs px-1" style={{ color: "rgb(21 128 61)" }}>Message sent.</p>
          )}
          {status === "error" && (
            <p className="text-xs px-1" style={{ color: "rgb(185 28 28)" }}>{errorMsg}</p>
          )}
        </form>
      )}

      {/* Log panel */}
      {tab === "log" && (
        <form onSubmit={handleLog} className="p-3 space-y-2">
          <p className="text-[11px] px-1" style={{ color: "var(--ink-muted)" }}>
            Paste a reply they sent you via email or WhatsApp — it will appear in the thread.
          </p>
          <div className="flex items-end gap-2">
            <textarea
              value={logBody}
              onChange={e => setLogBody(e.target.value)}
              placeholder="Paste their reply…"
              rows={3}
              className="flex-1 text-sm px-3 py-2 rounded-lg border resize-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-c)",
                color: "var(--ink)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={pending || !logBody.trim()}
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg disabled:opacity-50 transition-opacity"
              style={{ background: "var(--surface-2)", color: "var(--brand)", border: "1px solid var(--border-c)" }}
              aria-label="Log reply"
            >
              {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          {status === "ok" && (
            <p className="text-xs px-1" style={{ color: "rgb(21 128 61)" }}>Logged.</p>
          )}
        </form>
      )}
    </div>
  );
}
