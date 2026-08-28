"use client";

import { CheckCircle2, XCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Toast = { id: number; ok: boolean; title: string; body?: string };

type ToastCtx = { show: (ok: boolean, title: string, body?: string) => void };

const Ctx = createContext<ToastCtx>({ show: () => {} });

export function useToast() {
  return useContext(Ctx);
}

/** Strip raw agent log lines like "[dm-enrich] Fetching lead 123..." and return a clean summary. */
export function summariseOutput(raw: string, label: string): { title: string; body?: string } {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Last line that starts with "Done" or contains a count/summary
  const summary = lines.findLast(
    (l) =>
      /done|saved|found|nothing found|up to date|qualified|scored|sent|archived|skipped|processed|success/i.test(l) &&
      !/^\[/.test(l)        // not a raw log line
  );

  // Any line that looks like a real human-readable sentence (no [prefix])
  const cleaned = lines
    .filter((l) => !/^\[/.test(l))   // drop [agent-name] prefixed lines
    .filter((l) => l.length > 0);

  if (cleaned.length === 0) {
    return { title: `${label} complete` };
  }

  const title = summary ?? cleaned[cleaned.length - 1];
  const body = cleaned.length > 1 && !summary
    ? cleaned.slice(0, -1).join(" · ")
    : undefined;

  return { title, body };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((ok: boolean, title: string, body?: string) => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, ok, title, body }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <Ctx.Provider value={{ show }}>
      {children}

      {/* Toast stack — fixed bottom-right */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm animate-in slide-in-from-right-4 fade-in"
            style={{
              background: "var(--surface)",
              border: `1px solid ${t.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            {t.ok
              ? <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
              : <XCircle size={18} className="flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{t.title}</p>
              {t.body && (
                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--ink-muted)" }}>{t.body}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 mt-0.5"
              style={{ color: "var(--ink-muted)" }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
