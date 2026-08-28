"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MapPin, Mail, Phone, Globe, Search, X, ChevronUp, ChevronDown, Building2 } from "lucide-react";
import { LeadRowActions } from "./lead-row-actions";
import { googleMapsSearchUrl } from "@/lib/googleLinks";
import { formatDate } from "@/lib/time";

type Lead = {
  id: string;
  business_name: string;
  sector: string | null;
  source: string | null;
  location: string | null;
  website_url: string | null;
  email: string | null;
  phone: string | null;
  score: number | null;
  status: string;
  created_at: string | Date;
  recommended_services?: string[];
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; bg: string; text: string }> = {
  raw:       { dot: "bg-slate-400",       label: "New",       bg: "bg-slate-400/10",  text: "text-slate-500 dark:text-slate-400" },
  qualified: { dot: "bg-emerald-500",     label: "Qualified", bg: "bg-emerald-500/10",text: "text-emerald-700 dark:text-emerald-400" },
  contacted: { dot: "bg-blue-500",        label: "Contacted", bg: "bg-blue-500/10",   text: "text-blue-700 dark:text-blue-400" },
  archived:  { dot: "bg-slate-300",       label: "Not a fit", bg: "bg-slate-300/10",  text: "text-slate-400" },
};

const SECTOR_COLORS: Record<string, string> = {
  restaurant:    "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  retail:        "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  healthcare:    "bg-red-500/10 text-red-700 dark:text-red-400",
  technology:    "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  education:     "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  construction:  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  hospitality:   "bg-pink-500/10 text-pink-700 dark:text-pink-400",
  logistics:     "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  finance:       "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  manufacturing: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

function getSectorColor(sector: string | null) {
  if (!sector) return "bg-surface-2 text-ink-muted";
  const key = sector.toLowerCase().split(/[\s/]/)[0];
  return SECTOR_COLORS[key] ?? "bg-surface-2 text-ink-secondary";
}

function BusinessAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold flex-shrink-0"
      style={{ background: "var(--brand)", color: "#fff", opacity: 0.85 }}
    >
      {initials}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null)
    return <span className="text-xs tabular-nums" style={{ color: "var(--ink-muted)" }}>—/10</span>;

  const barColor = score >= 8 ? "#22c55e" : score >= 5 ? "#f59e0b" : "#ef4444";
  const textColor = score >= 8 ? "#15803d" : score >= 5 ? "#b45309" : "#b91c1c";
  const bg = score >= 8 ? "#dcfce7" : score >= 5 ? "#fef3c7" : "#fee2e2";

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="h-1.5 w-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: "var(--surface-2)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${score * 10}%`, background: barColor, transition: "width 0.4s ease" }}
        />
      </div>
      <span
        className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded"
        style={{ background: bg, color: textColor }}
      >
        {score}/10
      </span>
    </div>
  );
}

function ContactDots({ email, phone, website }: { email: string | null; phone: string | null; website: string | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        title={email ? `Email: ${email}` : "No email"}
        className="flex items-center justify-center w-6 h-6 rounded-md transition-transform hover:scale-110"
        style={email
          ? { background: "#dbeafe", color: "#1d4ed8", boxShadow: "0 0 0 1px #93c5fd" }
          : { background: "var(--surface-2)", color: "var(--border-c)" }
        }
      >
        <Mail size={11} strokeWidth={email ? 2.5 : 1.5} />
      </span>
      <span
        title={phone ? `Phone: ${phone}` : "No phone"}
        className="flex items-center justify-center w-6 h-6 rounded-md transition-transform hover:scale-110"
        style={phone
          ? { background: "#dcfce7", color: "#15803d", boxShadow: "0 0 0 1px #86efac" }
          : { background: "var(--surface-2)", color: "var(--border-c)" }
        }
      >
        <Phone size={11} strokeWidth={phone ? 2.5 : 1.5} />
      </span>
      <span
        title={website ? "Has website" : "No website"}
        className="flex items-center justify-center w-6 h-6 rounded-md transition-transform hover:scale-110"
        style={website
          ? { background: "#f3e8ff", color: "#7e22ce", boxShadow: "0 0 0 1px #d8b4fe" }
          : { background: "var(--surface-2)", color: "var(--border-c)" }
        }
      >
        <Globe size={11} strokeWidth={website ? 2.5 : 1.5} />
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.raw;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

type SortKey = "business_name" | "score" | "status" | "created_at";
type SortDir = "asc" | "desc";

export function LeadDiscoveryTable({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all"); // all | has-phone | has-email | no-contact | has-website | no-website
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const statuses = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => { counts[l.status] = (counts[l.status] ?? 0) + 1; });
    return counts;
  }, [leads]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => { if (l.sector) s.add(l.sector.toLowerCase()); });
    return [...s].sort();
  }, [leads]);

  const filtered = useMemo(() => {
    let rows = leads;
    if (statusFilter !== "all") rows = rows.filter((l) => l.status === statusFilter);
    if (sectorFilter !== "all") rows = rows.filter((l) => (l.sector ?? "").toLowerCase() === sectorFilter);
    if (contactFilter === "has-phone") rows = rows.filter((l) => !!l.phone);
    else if (contactFilter === "has-email") rows = rows.filter((l) => !!l.email);
    else if (contactFilter === "no-contact") rows = rows.filter((l) => !l.phone && !l.email);
    else if (contactFilter === "has-website") rows = rows.filter((l) => !!l.website_url);
    else if (contactFilter === "no-website") rows = rows.filter((l) => !l.website_url);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (l) =>
          l.business_name.toLowerCase().includes(q) ||
          (l.sector ?? "").toLowerCase().includes(q) ||
          (l.location ?? "").toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sortKey === "score") { av = a.score ?? -1; bv = b.score ?? -1; }
      else if (sortKey === "business_name") { av = a.business_name; bv = b.business_name; }
      else if (sortKey === "status") { av = a.status; bv = b.status; }
      else { av = String(a.created_at); bv = String(b.created_at); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [leads, query, statusFilter, sectorFilter, contactFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k)
      return <span className="opacity-30"><ChevronUp size={10} /></span>;
    return sortDir === "asc"
      ? <ChevronUp size={10} style={{ color: "var(--brand)" }} />
      : <ChevronDown size={10} style={{ color: "var(--brand)" }} />;
  }

  const statusOptions = ["all", ...Object.keys(STATUS_CONFIG).filter((s) => statuses[s])];

  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--ink-muted)" }} />
          <input
            type="text"
            placeholder="Search business, sector, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-c)",
              color: "var(--ink)",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--ink-muted)" }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusOptions.map((s) => {
            const active = statusFilter === s;
            const cfg = s !== "all" ? STATUS_CONFIG[s] : null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
                style={{
                  background: active ? "var(--brand)" : "var(--surface-2)",
                  color: active ? "#fff" : "var(--ink-secondary)",
                  border: active ? "1px solid var(--brand)" : "1px solid var(--border-c)",
                }}
              >
                {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                {s === "all" ? "All" : cfg?.label ?? s}
                {s === "all"
                  ? <span className="ml-0.5 opacity-70">{leads.length}</span>
                  : <span className="ml-0.5 opacity-70">{statuses[s] ?? 0}</span>}
              </button>
            );
          })}
        </div>

        {/* Sector dropdown */}
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
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "has-phone", "has-email", "has-website", "no-website", "no-contact"] as const).map((c) => {
            const labels: Record<string, string> = {
              all: "Any contact",
              "has-phone": "Has phone",
              "has-email": "Has email",
              "has-website": "Has website",
              "no-website": "No website",
              "no-contact": "No contact",
            };
            const active = contactFilter === c;
            return (
              <button
                key={c}
                onClick={() => setContactFilter(c)}
                className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
                style={{
                  background: active ? "var(--brand)" : "var(--surface-2)",
                  color: active ? "#fff" : "var(--ink-secondary)",
                  border: active ? "1px solid var(--brand)" : "1px solid var(--border-c)",
                }}
              >
                {labels[c]}
              </button>
            );
          })}
        </div>

        {/* Result count */}
        <span className="text-xs ml-auto" style={{ color: "var(--ink-muted)" }}>
          {filtered.length === leads.length
            ? `${leads.length} leads`
            : `${filtered.length} of ${leads.length}`}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border-c)", background: "var(--surface)" }}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Building2 size={32} style={{ color: "var(--border-c)" }} className="mb-3" />
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              {query || statusFilter !== "all" || sectorFilter !== "all" || contactFilter !== "all" ? "No leads match your filters" : "No leads yet"}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>
              {query || statusFilter !== "all" || sectorFilter !== "all" || contactFilter !== "all"
                ? "Try clearing the search or changing filters"
                : 'Click "Find businesses" to discover opportunities in your markets'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-c)", background: "var(--surface-2)" }}>
                  {/* Business — sortable */}
                  <th className="text-left px-4 py-2.5">
                    <button
                      onClick={() => toggleSort("business_name")}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      Business <SortIcon k="business_name" />
                    </button>
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Sector</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Location</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Contact</th>
                  {/* Score — sortable */}
                  <th className="text-left px-3 py-2.5">
                    <button
                      onClick={() => toggleSort("score")}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      Score <SortIcon k="score" />
                    </button>
                  </th>
                  {/* Status — sortable */}
                  <th className="text-left px-3 py-2.5">
                    <button
                      onClick={() => toggleSort("status")}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      Status <SortIcon k="status" />
                    </button>
                  </th>
                  {/* Found — sortable */}
                  <th className="text-left px-3 py-2.5">
                    <button
                      onClick={() => toggleSort("created_at")}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      Found <SortIcon k="created_at" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => (
                  <tr
                    key={lead.id}
                    className="row-hover group"
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--border-c)" : "none",
                    }}
                  >
                    {/* Business */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <BusinessAvatar name={lead.business_name} />
                        <div className="min-w-0">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="text-sm font-semibold hover:underline block truncate max-w-[200px]"
                            style={{ color: "var(--brand)" }}
                          >
                            {lead.business_name}
                          </Link>
                          {lead.source && (
                            <span className="text-[10px]" style={{ color: "var(--ink-muted)" }}>
                              via {lead.source === "maps" ? "Google Maps" : lead.source}
                            </span>
                          )}
                        </div>
                        <a
                          href={googleMapsSearchUrl(lead.business_name, lead.location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on Google Maps"
                          className="flex-shrink-0 transition-opacity opacity-50 hover:opacity-100"
                          style={{ color: "var(--ink-muted)" }}
                        >
                          <MapPin size={12} />
                        </a>
                      </div>
                    </td>

                    {/* Sector */}
                    <td className="px-3 py-3">
                      {lead.sector ? (
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-md capitalize ${getSectorColor(lead.sector)}`}>
                          {lead.sector}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>—</span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-3 py-3">
                      <span
                        className="text-xs truncate block max-w-[140px]"
                        title={lead.location ?? ""}
                        style={{ color: "var(--ink-secondary)" }}
                      >
                        {lead.location ?? "—"}
                      </span>
                    </td>

                    {/* Contact indicators */}
                    <td className="px-3 py-3">
                      <ContactDots
                        email={lead.email}
                        phone={lead.phone}
                        website={lead.website_url}
                      />
                    </td>

                    {/* Score bar */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <ScoreBar score={lead.score} />
                        {(lead.recommended_services?.length ?? 0) > 0 && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: "var(--brand)", color: "#fff", opacity: 0.8 }}
                          >
                            {lead.recommended_services!.length}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <StatusChip status={lead.status} />
                    </td>

                    {/* Found */}
                    <td className="px-3 py-3">
                      <span className="text-xs tabular-nums" style={{ color: "var(--ink-muted)" }}>
                        {formatDate(lead.created_at)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition-all"
                          style={{ background: "rgba(45,106,247,0.12)", color: "#2D6AF7" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(45,106,247,0.22)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(45,106,247,0.12)"; }}
                        >
                          View →
                        </Link>
                        <LeadRowActions
                          leadId={lead.id}
                          showQualify={lead.status === "raw"}
                          showEnrich
                          showArchive={lead.status !== "archived"}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
