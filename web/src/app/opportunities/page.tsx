import { AppShell } from "@/components/app-shell";
import { RunScoutModal } from "@/components/run-scout-modal";
import { OpportunityCardList } from "@/components/opportunity-card-list";
import { getLeads, PIPELINE_STAGES } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STAGE_FILTERS = ["All", ...PIPELINE_STAGES] as const;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const activeStage = stage ?? "All";

  const leads = await getLeads();

  const filtered =
    activeStage === "All"
      ? leads
      : leads.filter((l) => l.pipeline_stage === activeStage);

  // Stage counts for tabs
  const stageCounts = PIPELINE_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = leads.filter((l) => l.pipeline_stage === s).length;
    return acc;
  }, {});

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = leads.filter((l) => String(l.created_at).slice(0, 10) === todayStr).length;

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
          <div className="flex items-center gap-2">
            {todayCount > 0 && (
              <span
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{ background: "var(--surface)", border: "1px solid var(--border-c)", color: "var(--ink-secondary)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--brand)" }} />
                +{todayCount} found today
              </span>
            )}
            <RunScoutModal />
          </div>
        </div>

        {/* ── Pipeline stage tabs ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {STAGE_FILTERS.map((s) => {
            const isActive = s === activeStage;
            const href = s === "All" ? "/opportunities" : `/opportunities?stage=${encodeURIComponent(s)}`;
            const count = s === "All" ? leads.length : (stageCounts[s] ?? 0);
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
        <OpportunityCardList opportunities={filtered} />

      </div>
    </AppShell>
  );
}
