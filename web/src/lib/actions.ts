"use server";

import { revalidatePath } from "next/cache";
import { runAgentCommand } from "./runAgent";
import {
  approveOutreachDb,
  editOutreachDb,
  editProposalDb,
  archiveLeadDb,
  logReplyDb,
  markWhatsappSentDb,
  insertKnowledgeItemDb,
  updateKnowledgeItemDb,
  deleteKnowledgeItemDb,
  type KnowledgeItemInput,
} from "./mutations";
import { setSetting, type Settings } from "./settings";

function refreshAll() {
  revalidatePath("/agents");
  revalidatePath("/dashboard");
  revalidatePath("/lead-discovery");
  revalidatePath("/qualified-leads");
  revalidatePath("/outreach");
  revalidatePath("/follow-ups");
  revalidatePath("/proposals");
  revalidatePath("/analytics");
}

export async function runScoutAction(sector: string, city: string, limit: number) {
  const result = await runAgentCommand("scout", [
    "--sector", sector,
    "--city", city,
    "--limit", String(limit),
  ]);
  refreshAll();
  return result;
}

export async function runEnricherAction(limit: number, leadId?: string) {
  const args = leadId ? ["--lead-id", leadId] : ["--limit", String(limit)];
  const result = await runAgentCommand("enrich", args);
  refreshAll();
  return result;
}

export async function runQualifierAction(limit: number, leadId?: string) {
  const args = leadId ? ["--lead-id", leadId] : ["--limit", String(limit)];
  const result = await runAgentCommand("qualify", args);
  refreshAll();
  return result;
}

export async function runOutreachAction(limit: number, leadId?: string) {
  const args = leadId ? ["--lead-id", leadId] : ["--limit", String(limit)];
  const result = await runAgentCommand("outreach", args);
  refreshAll();
  return result;
}

export async function runSequencerAction() {
  const result = await runAgentCommand("sequence", ["--run-now"]);
  refreshAll();
  return result;
}

export async function runAnalyticsAction() {
  const result = await runAgentCommand("analytics", []);
  refreshAll();
  return result;
}

export async function runProposalAction(leadId: string, services: string[], budget: string) {
  const result = await runAgentCommand("proposal", [
    "--lead-id", leadId,
    "--services", services.join(","),
    "--budget", budget,
  ]);
  refreshAll();
  return result;
}

export async function sendOutreachAction(outreachId: string, to?: string) {
  const args = to ? ["--outreach-id", outreachId, "--to", to] : ["--outreach-id", outreachId];
  const result = await runAgentCommand("send", args);
  refreshAll();
  return result;
}

export async function approveOutreachAction(outreachId: string) {
  const row = await approveOutreachDb(outreachId);
  refreshAll();
  return { ok: Boolean(row) };
}

export async function editOutreachAction(outreachId: string, subject: string, body: string) {
  const row = await editOutreachDb(outreachId, subject, body);
  refreshAll();
  return { ok: Boolean(row) };
}

export async function editProposalAction(proposalId: string, content: string) {
  const row = await editProposalDb(proposalId, content);
  refreshAll();
  return { ok: Boolean(row) };
}

export async function archiveLeadAction(leadId: string) {
  const row = await archiveLeadDb(leadId);
  refreshAll();
  return { ok: Boolean(row) };
}

export async function logReplyAction(leadId: string, outreachId: string | null, body: string) {
  const row = await logReplyDb(leadId, outreachId, body);
  refreshAll();
  revalidatePath(`/leads/${leadId}`);
  return { ok: Boolean(row) };
}

export async function markWhatsappSentAction(outreachId: string) {
  const row = await markWhatsappSentDb(outreachId);
  refreshAll();
  return { ok: Boolean(row) };
}

export async function saveSettingsAction(settings: Settings) {
  try {
    await Promise.all(
      (Object.keys(settings) as (keyof Settings)[]).map((key) => setSetting(key, settings[key]))
    );
    revalidatePath("/settings");
    return { ok: true, output: "Settings saved." };
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : "Could not save settings." };
  }
}

export async function createKnowledgeItemAction(input: KnowledgeItemInput) {
  try {
    const row = await insertKnowledgeItemDb(input);
    revalidatePath("/knowledge-base");
    return { ok: true, output: `Saved "${row.title}".` };
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : "Could not save knowledge item." };
  }
}

export async function updateKnowledgeItemAction(id: string, input: KnowledgeItemInput) {
  try {
    const row = await updateKnowledgeItemDb(id, input);
    if (!row) return { ok: false, output: "Knowledge item not found." };
    revalidatePath("/knowledge-base");
    revalidatePath(`/knowledge-base/${id}`);
    return { ok: true, output: `Updated "${row.title}".` };
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : "Could not update knowledge item." };
  }
}

export async function deleteKnowledgeItemAction(id: string) {
  try {
    const row = await deleteKnowledgeItemDb(id);
    revalidatePath("/knowledge-base");
    return { ok: Boolean(row) };
  } catch {
    return { ok: false };
  }
}

export async function cleanKnowledgeContentAction(category: string, text: string) {
  const result = await runAgentCommand("clean-knowledge", ["--category", category, "--text", text]);
  return result;
}
