"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  createSignatureAction,
  deleteSignatureAction,
  runOutreachAction,
  updateSignatureAction,
} from "@/lib/actions";
import { ResultBanner } from "./modal";
import type { Signature } from "@/lib/queries";

function SignatureEditRow({
  signature,
  onDone,
}: {
  signature: Signature;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(signature.label);
  const [body, setBody] = useState(signature.body);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!label.trim() || !body.trim()) return;
    startTransition(async () => {
      await updateSignatureAction(signature.id, label.trim(), body.trim());
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-md border border-border-c bg-surface">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="text-xs px-2 py-1 rounded-md border border-border-c bg-surface-2"
      />
      <input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="text-xs px-2 py-1 rounded-md border border-border-c bg-surface-2"
      />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onDone} className="text-xs px-2 py-1 text-ink-secondary">
          Cancel
        </button>
        <button type="button" disabled={pending} onClick={save} className="text-xs px-2 py-1 rounded-md bg-brand text-white">
          Save
        </button>
      </div>
    </div>
  );
}

export function OutreachGeneratePanel({ signatures }: { signatures: Signature[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; output?: string } | null>(null);
  const [signatureId, setSignatureId] = useState(
    signatures.find((s) => s.is_default)?.id ?? signatures[0]?.id ?? ""
  );
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newBody, setNewBody] = useState("");

  function generate() {
    startTransition(async () => {
      setResult(null);
      const r = await runOutreachAction(10, undefined, signatureId || undefined);
      setResult(r);
    });
  }

  function addSignature() {
    if (!newLabel.trim() || !newBody.trim()) return;
    startTransition(async () => {
      const r = await createSignatureAction(newLabel.trim(), newBody.trim(), signatures.length === 0);
      if (r.ok && r.signature) {
        setSignatureId(r.signature.id);
        setNewLabel("");
        setNewBody("");
        setAdding(false);
      }
    });
  }

  function removeSignature(id: string) {
    startTransition(async () => {
      await deleteSignatureAction(id);
      if (signatureId === id) setSignatureId("");
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <select
          value={signatureId}
          onChange={(e) => setSignatureId(e.target.value)}
          className="text-sm border border-border-c bg-surface-2 rounded-lg px-2 py-2"
          disabled={signatures.length === 0}
        >
          {signatures.length === 0 ? (
            <option value="">No signature yet</option>
          ) : (
            signatures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          onClick={() => setManaging((v) => !v)}
          className="glass px-2.5 py-2 rounded-lg text-sm text-ink-secondary hover:bg-surface-2"
          title="Manage signatures"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          disabled={pending}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm hover:shadow-lg transition-all disabled:opacity-60"
          onClick={generate}
        >
          {pending ? "Drafting…" : "Generate drafts (score ≥ 6)"}
        </button>
      </div>

      {managing ? (
        <div className="w-full max-w-sm p-3 rounded-lg border border-border-c bg-surface-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">Signatures</span>
            <button type="button" onClick={() => setManaging(false)} className="text-ink-muted hover:text-ink">
              <X size={14} />
            </button>
          </div>

          {signatures.map((s) =>
            editingId === s.id ? (
              <SignatureEditRow key={s.id} signature={s} onDone={() => setEditingId(null)} />
            ) : (
              <div key={s.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-md bg-surface">
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{s.label}</p>
                  <p className="text-ink-muted truncate">{s.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => setEditingId(s.id)} className="p-1 text-ink-secondary hover:text-brand">
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => removeSignature(s.id)} className="p-1 text-ink-secondary hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          )}

          {adding ? (
            <div className="flex flex-col gap-1.5 p-2 rounded-md border border-border-c bg-surface">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (e.g. Ayinla — Tedmark Digital Agency Ltd)"
                className="text-xs px-2 py-1 rounded-md border border-border-c bg-surface-2"
              />
              <input
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Sign-off text (e.g. Ayinla, Tedmark Digital Agency Ltd)"
                className="text-xs px-2 py-1 rounded-md border border-border-c bg-surface-2"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setAdding(false)} className="text-xs px-2 py-1 text-ink-secondary">
                  Cancel
                </button>
                <button type="button" disabled={pending} onClick={addSignature} className="text-xs px-2 py-1 rounded-md bg-brand text-white">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md border border-dashed border-border-c text-ink-secondary hover:text-brand"
            >
              <Plus size={12} /> Add signature
            </button>
          )}
        </div>
      ) : null}

      {result ? <ResultBanner ok={result.ok} output={result.output ?? ""} /> : null}
    </div>
  );
}
