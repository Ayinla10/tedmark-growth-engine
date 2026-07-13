import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CommandShell } from "@/components/command-shell";
import { KnowledgeItemDetail } from "@/components/knowledge-item-detail";
import { getKnowledgeItemById, getKnowledgeUsage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function KnowledgeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, usage] = await Promise.all([getKnowledgeItemById(id), getKnowledgeUsage(id)]);
  if (!item) notFound();

  return (
    <CommandShell>
      <section className="p-6 pb-24 max-w-3xl">
        <Link href="/knowledge-base" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 mb-4">
          <ArrowLeft size={15} /> Back to Knowledge Base
        </Link>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-100">{item.title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            {item.category}
            {item.target_audience ? ` · ${item.target_audience}` : ""}
          </p>
        </div>

        <KnowledgeItemDetail
          item={item}
          outreachCount={usage.outreachCount}
          proposalCount={usage.proposalCount}
          recentOutreach={usage.recentOutreach}
          recentProposals={usage.recentProposals}
        />
      </section>
    </CommandShell>
  );
}
