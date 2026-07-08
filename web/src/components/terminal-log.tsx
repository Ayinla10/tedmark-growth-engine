"use client";

import { ChevronDown, ChevronUp, Download, Settings2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ActivityEvent = {
  at: string;
  agent: string;
  message: string;
};

const AGENT_COLORS: Record<string, string> = {
  SCOUT: "text-purple-700 dark:text-purple-400",
  QUALIFIER: "text-blue-700 dark:text-blue-400",
  OUTREACH: "text-amber-700 dark:text-amber-400",
  SEQUENCER: "text-pink-700 dark:text-pink-400",
  PROPOSAL: "text-green-700 dark:text-green-400",
};

const COMMAND_AGENT_COLORS: Record<string, string> = {
  SCOUT: "text-sky-400",
  QUALIFIER: "text-violet-400",
  OUTREACH: "text-amber-400",
  SEQUENCER: "text-indigo-400",
  PROPOSAL: "text-orange-400",
};

// `command` renders the log in the always-dark command-center style
// (used on the AI Orchestrator page) instead of following the app theme.
export function TerminalLog({ command = false }: { command?: boolean }) {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/activity");
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled) {
          setEvents(data.events);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <footer
      className={`fixed bottom-0 right-0 backdrop-blur-xl border-t z-40 overflow-hidden flex flex-col transition-[height] duration-300 ${
        minimized ? "h-9" : "h-56"
      } ${command ? "left-60 bg-[#04060d]/95 border-sky-500/15" : "left-64 bg-terminal/90 border-border-c"}`}
    >
      <div className="scanning-line opacity-10 pointer-events-none" />
      <div className={`flex items-center justify-between px-6 py-2 border-b ${command ? "bg-[#0a0f1e]/60 border-sky-500/15" : "bg-surface-2/40 border-border-c"}`}>
        <div className="flex items-center gap-4">
          <span className={`text-xs font-semibold uppercase tracking-widest ${command ? "text-indigo-300" : "text-ai"}`}>
            Activity log
          </span>
          <div className="flex gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
        <div className={`flex items-center gap-4 text-xs ${command ? "text-slate-500" : "text-ink-muted"}`}>
          <div className="flex gap-2 mr-2">
            <button type="button" aria-label="Clear log" className="hover:text-brand transition-colors">
              <Trash2 size={14} />
            </button>
            <button type="button" aria-label="Download log" className="hover:text-brand transition-colors">
              <Download size={14} />
            </button>
          </div>
          <span>Refreshes every 15s</span>
          <Settings2 size={14} aria-hidden="true" />
          <button
            type="button"
            aria-label={minimized ? "Expand activity log" : "Minimize activity log"}
            onClick={() => setMinimized((m) => !m)}
            className={`transition-colors ${command ? "hover:text-slate-200" : "hover:text-brand"}`}
          >
            {minimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      <div ref={scrollRef} className={`flex-1 p-4 font-mono text-[12px] terminal-scroll overflow-y-auto ${command ? "" : "bg-terminal/40"}`}>
        <div className="space-y-1">
          {error ? (
            <p className={`px-2 py-1.5 ${command ? "text-slate-500" : "text-ink-muted"}`}>Could not load activity — is the database reachable?</p>
          ) : events == null ? (
            <p className={`px-2 py-1.5 ${command ? "text-slate-500" : "text-ink-muted"}`}>Loading activity…</p>
          ) : events.length === 0 ? (
            <p className={`px-2 py-1.5 ${command ? "text-slate-500" : "text-ink-muted"}`}>
              No activity yet. Run the scout to get started: node index.js scout --sector &quot;restaurant&quot; --city &quot;Accra&quot; --limit 20
            </p>
          ) : (
            events.map((event, i) => (
              <div
                key={`${event.at}-${i}`}
                className={`flex items-center gap-4 py-1.5 px-2 border-b transition-colors ${
                  command ? "border-sky-500/10 hover:bg-white/5" : "border-border-c/50 hover:bg-ink/5"
                }`}
              >
                <span className={`font-mono opacity-60 whitespace-nowrap ${command ? "text-slate-500" : "text-ink-muted"}`}>
                  [{new Date(event.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}]
                </span>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-bold font-mono uppercase tracking-tighter bg-current/15 border-current/30 ${
                    command
                      ? (COMMAND_AGENT_COLORS[event.agent] ?? "text-slate-400")
                      : (AGENT_COLORS[event.agent] ?? "text-ink-secondary")
                  }`}
                >
                  {event.agent}
                </span>
                <span className={`font-sans truncate ${command ? "text-slate-300" : "text-ink"}`}>{event.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </footer>
  );
}
