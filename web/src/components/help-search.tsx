"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { HelpEntry } from "@/lib/helpContent";

export function HelpSearch({ entries }: { entries: HelpEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }, [entries, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, HelpEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div>
      <div className="relative mb-6 max-w-lg">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a button or feature…"
          className="w-full bg-surface-2 border-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-muted">No matches. Try a different word.</p>
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">{category}</p>
              <div className="space-y-3">
                {items.map((entry) => (
                  <div key={entry.id} className="bg-surface border border-border-c rounded-xl p-4">
                    <p className="text-sm font-semibold text-ink mb-1">{entry.title}</p>
                    <p className="text-sm text-ink-secondary leading-relaxed">{entry.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
