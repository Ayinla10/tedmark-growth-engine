import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CommandShell } from "@/components/command-shell";
import { KnowledgeItemFormPage } from "@/components/knowledge-item-form-page";
import { getKnowledgeItemById, getProposals } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditKnowledgeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, proposals] = await Promise.all([getKnowledgeItemById(id), getProposals()]);
  if (!item) notFound();

  return (
    <CommandShell>
      <section className="p-6 pb-24">
        <Link href={`/knowledge-base/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 mb-4">
          <ArrowLeft size={15} /> Back to item
        </Link>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-100">Edit Knowledge Item</h2>
          <p className="text-sm text-slate-400 mt-1">Update what Tedmark AI knows.</p>
        </div>
        <KnowledgeItemFormPage mode="edit" itemId={id} initial={item} proposals={proposals} />
      </section>
    </CommandShell>
  );
}
