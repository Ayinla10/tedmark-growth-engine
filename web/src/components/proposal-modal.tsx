"use client";

import { Copy, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { editProposalAction } from "@/lib/actions";
import { Modal, ResultBanner } from "./modal";

export type ProposalPreviewData = {
  id: string;
  business_name: string;
  services: string[] | null;
  budget_range: string | null;
  content: string | null;
};

export function ProposalModal({ row }: { row: ProposalPreviewData }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(row.content ?? "");
  const [pending, startTransition] = useTransition();
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
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs flex items-center gap-1 text-ink-secondary hover:text-brand"
              >
                <Pencil size={13} /> Edit
              </button>
            )}
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

        {result ? <ResultBanner ok={result.ok} output={result.output ?? ""} /> : null}
      </Modal>
    </>
  );
}
