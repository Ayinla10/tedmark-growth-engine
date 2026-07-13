"use client";

import { Copy, Download, Pencil, Send } from "lucide-react";
import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { editProposalAction, sendProposalAction } from "@/lib/actions";
import { Modal, ResultBanner } from "./modal";

export type ProposalPreviewData = {
  id: string;
  business_name: string;
  lead_email?: string | null;
  services: string[] | null;
  budget_range: string | null;
  content: string | null;
};

type KnowledgeRef = { id: string; title: string; category: string };

export function ProposalModal({ row, knowledgeRefs = [] }: { row: ProposalPreviewData; knowledgeRefs?: KnowledgeRef[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(row.content ?? "");
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; output?: string } | null>(null);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-brand hover:underline text-sm">
        Preview
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Proposal — ${row.business_name}`} wide>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-ink-secondary capitalize">
            {row.services?.join(", ") ?? "—"} &bull; {row.budget_range ?? "—"} budget
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs flex items-center gap-1 text-ink-secondary hover:text-brand"
              onClick={() => navigator.clipboard.writeText(content)}
            >
              <Copy size={13} /> Copy
            </button>
            <a
              href={`/api/proposals/${row.id}/pdf`}
              className="text-xs flex items-center gap-1 text-ink-secondary hover:text-brand"
            >
              <Download size={13} /> Download PDF
            </a>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs flex items-center gap-1 text-ink-secondary hover:text-brand"
              >
                <Pencil size={13} /> Edit
              </button>
            )}
            <button
              type="button"
              disabled={sending || !row.lead_email}
              title={row.lead_email ? undefined : "This lead has no email on file"}
              className="text-xs flex items-center gap-1 text-brand disabled:text-ink-muted disabled:cursor-not-allowed"
              onClick={() => {
                setSending(true);
                startTransition(async () => {
                  const r = await sendProposalAction(row.id);
                  setResult({ ok: r.ok, output: r.ok ? `Sent to ${row.lead_email}.` : r.output });
                  setSending(false);
                });
              }}
            >
              <Send size={13} /> {sending ? "Sending…" : "Send to lead"}
            </button>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full text-sm p-3 rounded-lg border border-border-c bg-surface-2 resize-y font-mono"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                className="bg-brand text-white px-3 py-1.5 rounded-lg text-sm"
                onClick={() =>
                  startTransition(async () => {
                    const r = await editProposalAction(row.id, content);
                    setResult({ ok: r.ok, output: r.ok ? "Saved." : "Could not save." });
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
          <div className="prose-proposal text-sm text-ink">
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-ink-muted">No content.</p>
            )}
          </div>
        )}

        {knowledgeRefs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border-c">
            <span className="text-xs text-ink-muted">Informed by:</span>
            {knowledgeRefs.map((ref) => (
              <a
                key={ref.id}
                href={`/knowledge-base/${ref.id}`}
                className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand hover:bg-brand/20"
              >
                {ref.title}
              </a>
            ))}
          </div>
        ) : null}

        {result ? <ResultBanner ok={result.ok} output={result.output ?? ""} /> : null}
      </Modal>
    </>
  );
}
