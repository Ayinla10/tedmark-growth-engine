"use client";

import { useRouter } from "next/navigation";
import { KnowledgeItemForm, type KnowledgeFormInitial, type ProposalOption } from "./knowledge-item-form";

export function KnowledgeItemFormPage({
  mode,
  itemId,
  initial,
  proposals,
}: {
  mode: "create" | "edit";
  itemId?: string;
  initial?: KnowledgeFormInitial;
  proposals: ProposalOption[];
}) {
  const router = useRouter();

  return (
    <KnowledgeItemForm
      mode={mode}
      itemId={itemId}
      initial={initial}
      proposals={proposals}
      onCancel={() => router.push("/knowledge-base")}
      onSaved={() => router.push(itemId ? `/knowledge-base/${itemId}` : "/knowledge-base")}
    />
  );
}
