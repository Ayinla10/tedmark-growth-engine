"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-surface border border-border-c rounded-2xl shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-c">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <button type="button" aria-label="Close" onClick={onClose} className="text-ink-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ResultBanner({ ok, output }: { ok: boolean; output: string }) {
  return (
    <div
      className={`mt-3 rounded-xl border p-3 text-xs font-mono whitespace-pre-wrap max-h-56 overflow-y-auto ${
        ok
          ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
      }`}
    >
      {output || (ok ? "Done." : "Something went wrong.")}
    </div>
  );
}
