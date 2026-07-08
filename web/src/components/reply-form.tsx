"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { logReplyAction } from "@/lib/actions";

export function ReplyForm({ leadId, latestOutreachId }: { leadId: string; latestOutreachId: string | null }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        startTransition(async () => {
          await logReplyAction(leadId, latestOutreachId, body.trim());
          setBody("");
        });
      }}
      className="flex items-end gap-2 mt-4"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Paste what the lead replied (from your email or WhatsApp)…"
        rows={2}
        className="flex-1 text-sm p-2.5 rounded-lg border border-border-c bg-surface-2 resize-none"
      />
      <button
        type="submit"
        disabled={pending || !body.trim()}
        className="bg-brand text-white p-2.5 rounded-lg disabled:opacity-60"
        aria-label="Log reply"
      >
        <Send size={16} />
      </button>
    </form>
  );
}
