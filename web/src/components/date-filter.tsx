"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, X } from "lucide-react";

const PRESETS = [
  { label: "Today",      days: 0 },
  { label: "Yesterday",  days: 1 },
  { label: "This week",  days: 7 },
  { label: "This month", days: 30 },
];

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DateFilter() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const [open, setOpen] = useState(false);

  const currentFrom = params.get("from") ?? "";
  const currentTo   = params.get("to")   ?? "";
  const hasFilter   = !!(currentFrom || currentTo);

  function apply(from: string, to: string) {
    const sp = new URLSearchParams(params.toString());
    if (from) sp.set("from", from); else sp.delete("from");
    if (to)   sp.set("to",   to);   else sp.delete("to");
    router.push(`${pathname}?${sp.toString()}`);
    setOpen(false);
  }

  function clear() {
    const sp = new URLSearchParams(params.toString());
    sp.delete("from");
    sp.delete("to");
    router.push(`${pathname}?${sp.toString()}`);
  }

  function applyPreset(days: number) {
    const today = new Date();
    const from  = new Date(today);
    from.setDate(today.getDate() - days);
    apply(toDateStr(from), toDateStr(today));
  }

  // Derive a display label for the active filter
  let activeLabel = "";
  if (hasFilter) {
    if (currentFrom === currentTo && currentFrom) {
      const d = new Date(currentFrom);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (currentFrom === toDateStr(new Date())) activeLabel = "Today";
      else if (currentFrom === toDateStr(yesterday)) activeLabel = "Yesterday";
      else activeLabel = currentFrom;
    } else if (currentFrom && currentTo) {
      activeLabel = `${currentFrom} → ${currentTo}`;
    } else if (currentFrom) {
      activeLabel = `From ${currentFrom}`;
    } else {
      activeLabel = `Until ${currentTo}`;
    }
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: hasFilter ? "var(--brand)" : "var(--surface)",
          color:      hasFilter ? "#fff"          : "var(--ink-muted)",
          border:     hasFilter ? "none"           : "1px solid var(--border-c)",
        }}
      >
        <CalendarDays size={13} />
        {hasFilter ? activeLabel : "Date found"}
        {hasFilter && (
          <span
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="ml-0.5 p-0.5 rounded-full hover:opacity-70"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 z-20 rounded-xl shadow-lg p-3 w-64"
            style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
          >
            {/* Quick presets */}
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
               style={{ color: "var(--ink-muted)" }}>Quick select</p>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.days)}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left"
                  style={{ background: "var(--surface-2)", color: "var(--ink-secondary)" }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
               style={{ color: "var(--ink-muted)" }}>Custom range</p>
            <div className="flex flex-col gap-1.5">
              <div>
                <label className="text-[10px] mb-0.5 block" style={{ color: "var(--ink-muted)" }}>From</label>
                <input
                  type="date"
                  defaultValue={currentFrom}
                  id="df-from"
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{
                    background: "var(--surface-2)",
                    color:      "var(--ink)",
                    border:     "1px solid var(--border-c)",
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] mb-0.5 block" style={{ color: "var(--ink-muted)" }}>To</label>
                <input
                  type="date"
                  defaultValue={currentTo}
                  id="df-to"
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{
                    background: "var(--surface-2)",
                    color:      "var(--ink)",
                    border:     "1px solid var(--border-c)",
                  }}
                />
              </div>
              <button
                onClick={() => {
                  const from = (document.getElementById("df-from") as HTMLInputElement).value;
                  const to   = (document.getElementById("df-to")   as HTMLInputElement).value;
                  apply(from, to);
                }}
                className="w-full py-1.5 rounded-lg text-xs font-medium mt-0.5"
                style={{ background: "var(--brand)", color: "#fff" }}
              >
                Apply range
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
