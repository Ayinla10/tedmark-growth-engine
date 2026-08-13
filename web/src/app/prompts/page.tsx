"use client";

import { useEffect, useState } from "react";

const PROMPTS: { file: string; label: string; description: string }[] = [
  { file: "qualify.md", label: "Qualifier", description: "How leads are scored 1–10 based on their digital presence" },
  { file: "icpScore.md", label: "ICP Scorer", description: "How sales-readiness is scored across Budget, Authority, Need, Urgency, Fit" },
  { file: "dmEnrich.md", label: "Decision-Maker Finder", description: "How the AI finds the name and title of the person to contact" },
  { file: "outreach.md", label: "Outreach (Email)", description: "How cold emails are written — tone, structure, personalisation rules" },
  { file: "outreach-whatsapp.md", label: "Outreach (WhatsApp)", description: "How WhatsApp first-contact messages are written" },
  { file: "followup-whatsapp.md", label: "Follow-up (WhatsApp)", description: "Follow-up messages for leads that haven't replied" },
  { file: "proposal.md", label: "Proposal", description: "How client proposals are drafted — structure and pricing guidance" },
  { file: "classify-reply.md", label: "Reply Classifier", description: "How inbound replies are classified (interested, not interested, etc.)" },
];

export default function PromptsPage() {
  const [selected, setSelected] = useState(PROMPTS[0].file);
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSaved(false);
    fetch(`/api/prompts?file=${selected}`)
      .then((r) => r.json())
      .then((d) => { setContent(d.content ?? ""); setOriginal(d.content ?? ""); })
      .catch(() => setError("Failed to load prompt"))
      .finally(() => setLoading(false));
  }, [selected]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: selected, content }),
      });
      if (!r.ok) throw new Error("Save failed");
      setOriginal(content);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const changed = content !== original;
  const currentPrompt = PROMPTS.find((p) => p.file === selected)!;

  return (
    <div className="flex h-screen bg-app-bg">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border-c bg-surface flex flex-col py-6">
        <div className="px-5 mb-6">
          <h1 className="text-sm font-semibold text-ink">System Prompts</h1>
          <p className="text-xs text-ink-muted mt-0.5">Edit how each AI agent thinks</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {PROMPTS.map((p) => (
            <button
              key={p.file}
              onClick={() => { if (!changed || confirm("You have unsaved changes. Switch anyway?")) setSelected(p.file); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                selected === p.file
                  ? "bg-brand/10 text-brand font-medium"
                  : "text-ink-secondary hover:bg-surface-2"
              }`}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <div className="px-5 pt-4 border-t border-border-c">
          <a href="/agents" className="text-xs text-ink-muted hover:text-brand">← Back to AI Agents</a>
        </div>
      </aside>

      {/* Editor */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border-c bg-surface">
          <div>
            <h2 className="text-base font-semibold text-ink">{currentPrompt.label}</h2>
            <p className="text-xs text-ink-muted mt-0.5">{currentPrompt.description}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {changed && (
              <button
                onClick={() => { setContent(original); setSaved(false); }}
                className="text-xs text-ink-muted hover:text-ink transition"
              >
                Discard changes
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || !changed}
              className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:opacity-90 transition disabled:opacity-40"
            >
              {saving ? "Saving…" : saved && !changed ? "Saved ✓" : "Save changes"}
            </button>
          </div>
        </div>

        {/* Warning banner */}
        <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
          <strong>Changes take effect immediately</strong> — the next time an agent runs, it will use whatever you save here. The original prompts are in <code className="font-mono">prompts/</code> in your project if you need to restore them.
        </div>

        {/* Textarea */}
        <div className="flex-1 flex flex-col px-6 py-4 min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-ink-muted">Loading…</div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setSaved(false); }}
              spellCheck={false}
              className="flex-1 w-full font-mono text-sm resize-none rounded-xl border border-border-c bg-surface p-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 leading-relaxed"
              style={{ minHeight: "400px" }}
            />
          )}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          {saved && !changed && <p className="mt-2 text-sm text-green-600 dark:text-green-400">Saved — agents will use this from their next run.</p>}
        </div>
      </main>
    </div>
  );
}
