"use client";

import { useEffect, useRef, useState } from "react";

type EnrichEvent = {
  type: "info" | "found" | "error" | "done";
  message: string;
  at: string;
};

function dot(type: EnrichEvent["type"]) {
  if (type === "found") return "bg-green-400";
  if (type === "error") return "bg-red-400";
  if (type === "done") return "bg-blue-400";
  return "bg-slate-400";
}

function textColor(type: EnrichEvent["type"]) {
  if (type === "found") return "var(--green, #34d399)";
  if (type === "error") return "#f87171";
  if (type === "done") return "var(--brand)";
  return "var(--ink-secondary)";
}

export function EnrichLiveFeed({ leadId, onDone }: { leadId: number; onDone?: () => void }) {
  const [events, setEvents] = useState<EnrichEvent[]>([]);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEvents([]);
    setDone(false);

    const es = new EventSource(`/api/enrich-live?leadId=${leadId}`);

    es.onmessage = (e) => {
      try {
        const event: EnrichEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
        if (event.type === "done") {
          setDone(true);
          es.close();
          onDone?.();
        }
      } catch { /* skip malformed */ }
    };

    es.onerror = () => es.close();

    return () => es.close();
  }, [leadId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 rounded-xl text-sm"
        style={{ background: "var(--surface-2)", color: "var(--ink-muted)" }}>
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
        Agent is starting...
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-c)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border-c)" }}>
        {!done
          ? <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
          : <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />}
        <span className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--ink-muted)" }}>
          {done ? "Enrichment complete" : "Agent browsing live..."}
        </span>
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        className="font-mono text-[12px] space-y-1 p-3 overflow-y-auto"
        style={{ maxHeight: 220, background: "var(--surface)" }}
      >
        {events.map((ev, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dot(ev.type)}`} />
            <span style={{ color: textColor(ev.type), lineHeight: "1.5" }}>{ev.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
