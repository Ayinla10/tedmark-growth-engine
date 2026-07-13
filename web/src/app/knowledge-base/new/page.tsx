import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CommandShell } from "@/components/command-shell";
import { KnowledgeItemFormPage } from "@/components/knowledge-item-form-page";
import { getProposals } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewKnowledgeItemPage() {
  const proposals = await getProposals();

  return (
    <CommandShell>
      <section className="p-6 pb-24">
        <Link href="/knowledge-base" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 mb-4">
          <ArrowLeft size={15} /> Back to Knowledge Base
        </Link>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-100">Teach Tedmark AI Something New</h2>
          <p className="text-sm text-slate-400 mt-1">
            Add company knowledge that your AI agents can use to create better responses, recommendations, and business decisions.
          </p>
        </div>
        <KnowledgeItemFormPage mode="create" proposals={proposals} />
      </section>
    </CommandShell>
  );
}
