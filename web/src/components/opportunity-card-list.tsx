"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Mail,
  Phone,
  Globe,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  MapPin,
} from "lucide-react";

type Opp = {
  id: string;
  business_name: string;
  sector: string | null;
  location: string | null;
  website_url: string | null;
  email: string | null;
  phone: string | null;
  score: number | null;
  score_reason: string | null;
  status: string;
  pipeline_stage: string;
  next_action: string | null;
  next_action_due: string | null;
  recommended_service: string | null;
  recommended_services: string[];
  problems: string[];
  dm_name: string | null;
  created_at: string;
};

/* ── Strength label ────────────────────────────────────────────────────── */
function strengthLabel(score: number | null): { label: string; color: string; bg: string } {
  if (score == null) return { label: "Not yet assessed", color: "var(--ink-muted)", bg: "var(--surface-2)" };
  if (score >= 8) return { label: "Strong opportunity", color: "rgb(21 128 61)", bg: "rgba(34,197,94,0.10)" };
  if (score >= 6) return { label: "Good opportunity",   color: "rgb(133 77 14)",  bg: "rgba(245,158,11,0.10)" };
  if (score >= 4) return { label: "Possible opportunity",color: "rgb(59 130 246)",bg: "rgba(59,130,246,0.10)" };
  return { label: "Low priority", color: "var(--ink-muted)", bg: "var(--surface-2)" };
}

/* ── Stage pill ────────────────────────────────────────────────────────── */
const STAGE_COLOR: Record<string, string> = {
  New:            "rgba(107,159,255,0.12)",
  Contacted:      "rgba(251,191,36,0.12)",
  Qualified:      "rgba(52,211,153,0.12)",
  "Proposal Sent":"rgba(245,158,11,0.12)",
  Negotiating:    "rgba(167,139,250,0.12)",
  Won:            "rgba(34,197,94,0.12)",
  Lost:           "rgba(239,68,68,0.10)",
};
const STAGE_TEXT: Record<string, string> = {
  New:            "#6b9fff",
  Contacted:      "#b45309",
  Qualified:      "#065f46",
  "Proposal Sent":"#92400e",
  Negotiating:    "#5b21b6",
  Won:            "#14532d",
  Lost:           "#991b1b",
};

function StagePill({ stage }: { stage: string }) {
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: STAGE_COLOR[stage] ?? "var(--surface-2)",
        color: STAGE_TEXT[stage] ?? "var(--ink-muted)",
      }}
    >
      {stage}
    </span>
  );
}

/* ── Contactability dot row ────────────────────────────────────────────── */
function Contactability({ email, phone, website, dm }: { email: string | null; phone: string | null; website: string | null; dm: string | null }) {
  const icons = [
    { icon: Mail,     has: !!email,   title: email   ?? "No email",   color: "#1d4ed8", bg: "#dbeafe" },
    { icon: Phone,    has: !!phone,   title: phone   ?? "No phone",   color: "#15803d", bg: "#dcfce7" },
    { icon: Globe,    has: !!website, title: website ?? "No website", color: "#7e22ce", bg: "#f3e8ff" },
  ];
  const hasAny = !!email || !!phone || !!website;
  return (
    <div className="flex items-center gap-1.5">
      {icons.map(({ icon: Icon, has, title, color, bg }) => (
        <span
          key={title}
          title={title}
          className="flex items-center justify-center w-5 h-5 rounded-md"
          style={has ? { background: bg, color } : { background: "var(--surface-2)", color: "var(--border-c)" }}
        >
          <Icon size={10} strokeWidth={has ? 2.5 : 1.5} />
        </span>
      ))}
      {dm && (
        <span
          className="text-[10px] font-medium ml-0.5 px-1.5 py-0.5 rounded-full"
          style={{ background: "rgba(107,159,255,0.12)", color: "var(--brand)" }}
          title={`Decision-maker: ${dm}`}
        >
          DM
        </span>
      )}
      {!hasAny && !dm && (
        <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>No contact info</span>
      )}
    </div>
  );
}

/* ── Opportunity card ──────────────────────────────────────────────────── */
function OppCard({ opp }: { opp: Opp }) {
  const { label, color, bg } = strengthLabel(opp.score);
  const service = opp.recommended_services?.[0] ?? opp.recommended_service ?? null;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 transition-all"
      style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
        style={{ background: "var(--brand)", color: "#fff", opacity: 0.85 }}
      >
        {opp.business_name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Name + location */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: "var(--ink)" }}>
              {opp.business_name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
              {[opp.location, opp.sector].filter(Boolean).join(" · ")}
            </p>
          </div>
          <StagePill stage={opp.pipeline_stage} />
        </div>

        {/* Strength + service row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: bg, color }}
          >
            {label}
          </span>
          {service && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
              style={{ background: "var(--surface-2)", color: "var(--ink-secondary)", border: "1px solid var(--border-c)" }}
            >
              {service.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Why — score reason or first problem */}
        {(opp.score_reason || opp.problems?.[0]) && (
          <p
            className="text-xs mt-2 leading-relaxed line-clamp-2"
            style={{ color: "var(--ink-secondary)" }}
          >
            {opp.score_reason ?? opp.problems[0]}
          </p>
        )}

        {/* Bottom row */}
        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Contactability
              email={opp.email}
              phone={opp.phone}
              website={opp.website_url}
              dm={opp.dm_name}
            />
            {opp.next_action && (
              <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
                Next: {opp.next_action}
                {opp.next_action_due ? ` · ${opp.next_action_due}` : ""}
              </p>
            )}
          </div>
          <Link
            href={`/opportunities/${opp.id}`}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
            style={{ background: "var(--brand)", color: "#fff" }}
          >
            Open <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Sort / filter ─────────────────────────────────────────────────────── */
type SortKey = "score" | "pipeline_stage" | "business_name" | "created_at";

export function OpportunityCardList({ opportunities }: { opportunities: Opp[] }) {
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sectors = useMemo(() => {
    const s = new Set<string>();
    opportunities.forEach((o) => { if (o.sector) s.add(o.sector.toLowerCase()); });
    return [...s].sort();
  }, [opportunities]);

  const filtered = useMemo(() => {
    let rows = opportunities;
    if (sectorFilter !== "all") rows = rows.filter((o) => (o.sector ?? "").toLowerCase() === sectorFilter);
    if (contactFilter === "has-phone") rows = rows.filter((o) => !!o.phone);
    else if (contactFilter === "has-email") rows = rows.filter((o) => !!o.email);
    else if (contactFilter === "has-dm") rows = rows.filter((o) => !!o.dm_name);
    else if (contactFilter === "no-contact") rows = rows.filter((o) => !o.phone && !o.email);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (o) =>
          o.business_name.toLowerCase().includes(q) ||
          (o.sector ?? "").toLowerCase().includes(q) ||
          (o.location ?? "").toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "score") { av = a.score ?? -1; bv = b.score ?? -1; }
      else if (sortKey === "business_name") { av = a.business_name; bv = b.business_name; }
      else if (sortKey === "pipeline_stage") { av = a.pipeline_stage; bv = b.pipeline_stage; }
      else { av = a.created_at; bv = b.created_at; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [opportunities, query, sectorFilter, contactFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
        style={{
          background: active ? "var(--brand)" : "var(--surface-2)",
          color: active ? "#fff" : "var(--ink-secondary)",
          border: "1px solid var(--border-c)",
        }}
      >
        {label}
        {active && (
          sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />
        )}
      </button>
    );
  }

  return (
    <div>
      {/* ── Filter / sort bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--ink-muted)" }} />
          <input
            type="text"
            placeholder="Search by name, sector, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-c)", color: "var(--ink)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-muted)" }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Sector */}
        {sectors.length > 0 && (
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg"
            style={{
              background: sectorFilter !== "all" ? "var(--brand)" : "var(--surface-2)",
              color: sectorFilter !== "all" ? "#fff" : "var(--ink-secondary)",
              border: "1px solid var(--border-c)",
            }}
          >
            <option value="all">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s} style={{ background: "var(--surface)", color: "var(--ink)" }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        )}

        {/* Contact filter */}
        {(["all", "has-email", "has-phone", "has-dm", "no-contact"] as const).map((c) => {
          const labels: Record<string, string> = { all: "Any", "has-email": "Has email", "has-phone": "Has phone", "has-dm": "Has DM", "no-contact": "No contact" };
          if (c === "all") return null;
          const active = contactFilter === c;
          return (
            <button
              key={c}
              onClick={() => setContactFilter(contactFilter === c ? "all" : c)}
              className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: active ? "var(--brand)" : "var(--surface-2)",
                color: active ? "#fff" : "var(--ink-secondary)",
                border: "1px solid var(--border-c)",
              }}
            >
              {labels[c]}
            </button>
          );
        })}

        {/* Sort */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[11px] mr-1" style={{ color: "var(--ink-muted)" }}>Sort:</span>
          <SortBtn k="score" label="Strength" />
          <SortBtn k="pipeline_stage" label="Stage" />
          <SortBtn k="created_at" label="Found" />
        </div>
      </div>

      {/* ── Count ───────────────────────────────────────────────── */}
      <p className="text-xs mb-3" style={{ color: "var(--ink-muted)" }}>
        {filtered.length === opportunities.length
          ? `${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"}`
          : `${filtered.length} of ${opportunities.length}`}
      </p>

      {/* ── Cards ───────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}
        >
          <Building2 size={28} className="mx-auto mb-3" style={{ color: "var(--ink-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            {query || sectorFilter !== "all" || contactFilter !== "all"
              ? "No opportunities match your filters"
              : "No opportunities yet"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>
            {query || sectorFilter !== "all" || contactFilter !== "all"
              ? "Try clearing the search or changing filters"
              : "The AI will discover businesses in your target markets automatically."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((opp) => <OppCard key={opp.id} opp={opp} />)}
        </div>
      )}
    </div>
  );
}
