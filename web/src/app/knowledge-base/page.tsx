import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  ClipboardList,
  FileStack,
  FileText,
  HelpCircle,
  Layers,
  Plus,
  Search as SearchIcon,
} from "lucide-react";
import { CommandShell } from "@/components/command-shell";
import { Sparkline } from "@/components/sparkline";
import {
  getKnowledgeCategoryStats,
  getKnowledgeItemsWithUsage,
} from "@/lib/queries";
import { AGENT_LABELS } from "@/lib/knowledge-constants";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  "Company Knowledge": Briefcase,
  "Services & Pricing": FileText,
  "Sales Playbook": ClipboardList,
  "Case Study": FileStack,
  "SEO Research": SearchIcon,
  "Content Library": Layers,
  FAQ: HelpCircle,
  "SOP / Workflow": BookOpen,
};

function pctChange(now: number, before: number): { label: string; positive: boolean } {
  if (before === 0 && now === 0) return { label: "—", positive: true };
  if (before === 0) return { label: `+${now}`, positive: true };
  const pct = Math.round(((now - before) / before) * 1000) / 10;
  return { label: `${pct >= 0 ? "+" : ""}${pct}%`, positive: pct >= 0 };
}

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [categoryStats, items] = await Promise.all([getKnowledgeCategoryStats(), getKnowledgeItemsWithUsage()]);

  const filteredItems = q
    ? items.filter(
        (i) =>
          i.title.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase())
      )
    : items;

  return (
    <CommandShell>
      <section className="p-6 pb-24 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <form className="relative w-full max-w-md">
            <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search knowledge, categories…"
              className="bg-[#0b1120] border border-slate-700/40 rounded-lg pl-9 pr-4 py-2 text-sm w-full text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </form>
          <Link
            href="/knowledge-base/new"
            className="bg-emerald-500 text-black px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all"
          >
            <Plus size={16} /> Add Knowledge
          </Link>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-slate-100">Knowledge Intelligence</h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Sync Active
            </span>
          </div>
          <p className="text-sm text-slate-400">Monitor how your AI agents utilize categorized specialized data.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryStats.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.category] ?? BookOpen;
            const change = pctChange(cat.thisWeek, cat.lastWeek);
            return (
              <div key={cat.category} className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Icon size={16} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] tracking-wider text-slate-500 uppercase">Weekly usage</p>
                    <p className={`text-sm font-semibold ${change.positive ? "text-emerald-400" : "text-red-400"}`}>{change.label}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-100">{cat.category}</p>
                <p className="text-xs text-slate-500 mb-2">
                  {cat.itemCount} item{cat.itemCount === 1 ? "" : "s"} &middot; {cat.contentSizeKb} KB
                </p>
                <Sparkline data={cat.sparkline} color={change.positive ? "#22c55e" : "#f87171"} />
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/10">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Recent Insights Performance</h3>
              <p className="text-xs text-slate-500">Real usage data — no vanity metrics.</p>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm font-medium text-slate-300">{q ? `No knowledge items match "${q}"` : "No knowledge items yet"}</p>
              <p className="text-xs text-slate-500 mt-1">
                <Link href="/knowledge-base/new" className="text-emerald-400 hover:underline">
                  Add your first item
                </Link>{" "}
                to teach your agents real facts about Tedmark.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 text-left">
                    <th className="px-5 py-2.5 font-medium">Title</th>
                    <th className="px-5 py-2.5 font-medium">Category</th>
                    <th className="px-5 py-2.5 font-medium">Usage</th>
                    <th className="px-5 py-2.5 font-medium">Deployed to</th>
                    <th className="px-5 py-2.5 font-medium">Reply rate</th>
                    <th className="px-5 py-2.5 font-medium">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/knowledge-base/${item.id}`} className="text-slate-100 font-medium hover:text-emerald-400">
                          {item.title}
                        </Link>
                        {item.status === "draft" ? (
                          <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">DRAFT</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-emerald-400 text-xs">{item.category}</td>
                      <td className="px-5 py-3 text-slate-300">
                        {item.usageCount > 0 ? `Used in ${item.usageCount} message${item.usageCount === 1 ? "" : "s"}` : "Not used yet"}
                      </td>
                      <td className="px-5 py-3 text-slate-300">
                        {item.applicable_agents.length} agent{item.applicable_agents.length === 1 ? "" : "s"}
                        <p className="text-xs text-slate-500 truncate max-w-[180px]">
                          {item.applicable_agents.map((a) => AGENT_LABELS[a]?.replace(" Agent", "")).join(", ")}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        {item.replyRate != null ? (
                          <span className="text-emerald-400 font-mono">{item.replyRate}%</span>
                        ) : (
                          <span className="text-slate-500 font-mono">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-400 font-mono text-xs">{timeAgo(item.lastUsedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </CommandShell>
  );
}
