"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Tag, X } from "lucide-react";

interface Props {
  sectors: string[];
}

export function SectorFilter({ sectors }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const active = params.get("sector") ?? "";

  function select(sector: string) {
    const sp = new URLSearchParams(params.toString());
    if (sector) sp.set("sector", sector); else sp.delete("sector");
    router.push(`${pathname}?${sp.toString()}`);
  }

  if (sectors.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
        <Tag size={12} />
        Sector:
      </span>
      {active && (
        <button
          onClick={() => select("")}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-all"
          style={{ background: "var(--brand)", color: "#fff" }}
        >
          {active}
          <X size={11} />
        </button>
      )}
      {!active && sectors.map((s) => (
        <button
          key={s}
          onClick={() => select(s)}
          className="text-xs px-2.5 py-1 rounded-full transition-all"
          style={{
            background: "var(--surface)",
            color: "var(--ink-muted)",
            border: "1px solid var(--border-c)",
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
