import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { RunScoutModal } from "@/components/run-scout-modal";
import { OpportunityCardList } from "@/components/opportunity-card-list";
import { DateFilter } from "@/components/date-filter";
import { SectorFilter } from "@/components/sector-filter";
import { getLeads, getLeadsCount, getSectorBreakdown, PIPELINE_STAGES } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STAGE_FILTERS = ["All", ...PIPELINE_STAGES] as const;
const PAGE_SIZE = 50;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; from?: string; to?: string; sector?: string; page?: string }>;
}) {
  const { stage, from, to, sector, page: pageParam } = await searchParams;
  const activeStage = stage ?? "All";
  const dateRange   = (from || to) ? { from, to } : undefined;
  const page        = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [leads, total, sectorStats] = await Promise.all([
    getLeads(undefined, dateRange, sector, page),
    getLeadsCount(undefined, dateRange, sector),
    getSectorBreakdown(20),
  ]);
  const sectorList = sectorStats.map((s) => s.sector);

  const filtered =
    activeStage === "All"
      ? leads
      : leads.filter((l) => l.pipeline_stage === activeStage);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Stage counts come from the full count query — approximate from current page for tab labels
  const stageCounts = PIPELINE_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = leads.filter((l) => l.pipeline_stage === s).length;
    return acc;
  }, {});

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = leads.filter((l) => String(l.created_at).slice(0, 10) === todayStr).length;

  function pageLink(p: number) {
    const sp = new URLSearchParams();
    if (stage && stage !== "All") sp.set("stage", stage);
    if (sector) sp.set("sector", sector);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/opportunities?${qs}` : "/opportunities";
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen" style={{ background: "var(--app-bg)" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
              Opportunities
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>
              Businesses that may be worth pursuing.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {todayCount > 0 && (
              <span
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{ background: "var(--surface)", border: "1px solid var(--border-c)", color: "var(--ink-secondary)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--brand)" }} />
                +{todayCount} found today
              </span>
            )}
            <Suspense><DateFilter /></Suspense>
            <RunScoutModal />
          </div>
        </div>

        {/* ── Sector filter pills ─────────────────────────────────────────── */}
        {sectorList.length > 0 && (
          <div className="mb-4">
            <Suspense><SectorFilter sectors={sectorList} /></Suspense>
          </div>
        )}

        {/* ── Pipeline stage tabs ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {STAGE_FILTERS.map((s) => {
            const isActive = s === activeStage;
            const sp = new URLSearchParams();
            if (s !== "All") sp.set("stage", s);
            if (sector) sp.set("sector", sector);
            if (from) sp.set("from", from);
            if (to) sp.set("to", to);
            const qs = sp.toString();
            const href = qs ? `/opportunities?${qs}` : "/opportunities";
            const count = s === "All" ? total : (stageCounts[s] ?? 0);
            return (
              <Link
                key={s}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  background: isActive ? "var(--brand)" : "var(--surface)",
                  color: isActive ? "#fff" : "var(--ink-muted)",
                  border: isActive ? "none" : "1px solid var(--border-c)",
                }}
              >
                {s}
                <span
                  className="text-[10px] px-1.5 rounded-full tabular-nums"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.2)" : "var(--surface-2)",
                    color: isActive ? "#fff" : "var(--ink-muted)",
                  }}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Opportunity cards ───────────────────────────────────────────── */}
        <OpportunityCardList
          opportunities={filtered}
          total={total}
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          pageLink={pageLink}
        />

      </div>
    </AppShell>
  );
}
