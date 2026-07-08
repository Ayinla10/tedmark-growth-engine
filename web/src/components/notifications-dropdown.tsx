"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ActivityEvent = {
  at: string;
  agent: string;
  message: string;
};

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open || events !== null) return;

    fetch("/api/activity")
      .then((r) => r.json())
      .then((d) => setEvents(d.events.slice(0, 10)))
      .catch(() => setError(true));
  }, [open, events]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="hover:text-brand transition-all active:scale-95"
      >
        <Bell size={20} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-96 bg-surface border border-border-c rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="px-4 py-3 border-b border-border-c">
            <p className="text-sm font-semibold text-ink">Recent activity</p>
            <p className="text-xs text-ink-muted">What the agents have done, most recent first.</p>
          </div>
          <div className="divide-y divide-border-c">
            {error ? (
              <p className="text-sm text-ink-muted px-4 py-3">Could not load activity.</p>
            ) : events === null ? (
              <p className="text-sm text-ink-muted px-4 py-3">Loading…</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-ink-muted px-4 py-3">
                Nothing yet — run the scout to get started.
              </p>
            ) : (
              events.map((e, i) => (
                <div key={i} className="px-4 py-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ai">{e.agent}</span>
                    <span className="text-[11px] text-ink-muted">
                      {new Date(e.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-ink-secondary line-clamp-2">{e.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
