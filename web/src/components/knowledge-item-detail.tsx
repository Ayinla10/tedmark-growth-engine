"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteKnowledgeItemAction } from "@/lib/actions";
import { AGENT_LABELS } from "@/lib/knowledge-constants";
import { formatDate } from "@/lib/time";

type Item = {
  id: string;
  title: string;
  category: string;
  content: string;
  applicable_agents: string[];
  target_audience: string | null;
  tags: string[];
  source: string | null;
  status: "draft" | "published";
  updated_at: string;
};

type UsageRef = { id: string; lead_id: string; business_name: string; created_at: string };

export function KnowledgeItemDetail({
  item,
  outreachCount,
  proposalCount,
  recentOutreach,
  recentProposals,
}: {
  item: Item;
  outreachCount: number;
  proposalCount: number;
  recentOutreach: UsageRef[];
  recentProposals: UsageRef[];
}) {
  const [deleting, startDelete] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    startDelete(async () => {
      const r = await deleteKnowledgeItemAction(item.id);
      if (r.ok) router.push("/knowledge-base");
    });
  }

  const totalUsage = outreachCount + proposalCount;

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <Link
          href={`/knowledge-base/${item.id}/edit`}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-200 hover:bg-slate-800/50"
        >
          <Pencil size={14} /> Edit
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>

      <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-6 mb-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Content</h3>
        <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed border-l-2 border-emerald-500/50 pl-4">{item.content}</div>
      </div>

      <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-6 mb-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Used by</h3>
        <div className="flex flex-wrap gap-2">
          {item.applicable_agents.length === 0 ? (
            <span className="text-sm text-slate-500">No agents assigned</span>
          ) : (
            item.applicable_agents.map((a) => (
              <span key={a} className="text-xs font-medium px-2.5 py-1 rounded-full border border-emerald-500/30 text-emerald-400">
                {AGENT_LABELS[a] ?? a}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-6 mb-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Real usage</h3>
        {totalUsage === 0 ? (
          <p className="text-sm text-slate-500">
            Not used in any generated message or proposal yet — it&rsquo;ll show up here the next time an agent it&rsquo;s assigned to runs.
          </p>
        ) : (
          <>
            <div className="flex gap-6 mb-4">
              <div>
                <p className="text-2xl font-semibold text-slate-100">{outreachCount}</p>
                <p className="text-xs text-slate-500">outreach messages informed</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-100">{proposalCount}</p>
                <p className="text-xs text-slate-500">proposals informed</p>
              </div>
            </div>
            {recentOutreach.length > 0 || recentProposals.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500 mb-1">Most recent:</p>
                {recentOutreach.map((r) => (
                  <a key={r.id} href={`/leads/${r.lead_id}`} className="block text-sm text-emerald-400 hover:underline">
                    Outreach for {r.business_name} &middot; {formatDate(r.created_at)}
                  </a>
                ))}
                {recentProposals.map((r) => (
                  <a key={r.id} href={`/leads/${r.lead_id}`} className="block text-sm text-emerald-400 hover:underline">
                    Proposal for {r.business_name} &middot; {formatDate(r.created_at)}
                  </a>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Details</h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500 text-xs">Status</dt>
            <dd className="text-slate-200 capitalize">{item.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Tags</dt>
            <dd className="text-slate-200">{item.tags.length > 0 ? item.tags.join(", ") : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Source</dt>
            <dd className="text-slate-200">{item.source ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Last updated</dt>
            <dd className="text-slate-200">{formatDate(item.updated_at)}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
