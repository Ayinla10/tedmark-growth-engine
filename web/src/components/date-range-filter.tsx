"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function DateRangeFilter({ label = "Filter by date" }: { label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const hasFilter = Boolean(from || to);

  function update(next: { from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextFrom = next.from !== undefined ? next.from : from;
    const nextTo = next.to !== undefined ? next.to : to;

    if (nextFrom) params.set("from", nextFrom);
    else params.delete("from");

    if (nextTo) params.set("to", nextTo);
    else params.delete("to");

    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted text-xs">{label}</span>
      <input
        type="date"
        value={from}
        onChange={(e) => update({ from: e.target.value })}
        className="text-xs py-1"
        aria-label="From date"
      />
      <span className="text-ink-muted text-xs">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => update({ to: e.target.value })}
        className="text-xs py-1"
        aria-label="To date"
      />
      {hasFilter ? (
        <button
          type="button"
          onClick={() => router.replace(pathname)}
          className="text-ink-muted hover:text-red-500"
          aria-label="Clear date filter"
          title="Clear"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
