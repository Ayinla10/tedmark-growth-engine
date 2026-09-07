"use server";

import { revalidatePath } from "next/cache";
import { runAgentCommand } from "./runAgent";
import {
  approveOutreachDb,
  editOutreachDb,
  editProposalDb,
  archiveLeadDb,
  updatePipelineDb,
  generateTelegramLinkCodeDb,
  updateTelegramNotificationLevelDb,
  unlinkTelegramDb,
  logReplyDb,
  markWhatsappSentDb,
  sendDirectReplyDb,
  insertKnowledgeItemDb,
  updateKnowledgeItemDb,
  deleteKnowledgeItemDb,
  insertSignatureDb,
  updateSignatureDb,
  setDefaultSignatureDb,
  deleteSignatureDb,
  insertAgentRunDb,
  type KnowledgeItemInput,
} from "./mutations";
import { setSetting, type Settings } from "./settings";
import { getSession } from "./auth";

function refreshAll(leadId?: string) {
  revalidatePath("/agents");
  revalidatePath("/dashboard");
  revalidatePath("/lead-discovery");
  revalidatePath("/qualified-leads");
  revalidatePath("/outreach");
  revalidatePath("/follow-ups");
  revalidatePath("/proposals");
  revalidatePath("/analytics");
  revalidatePath("/opportunities");
  if (leadId) revalidatePath(`/opportunities/${leadId}`);
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

async function logRun(command: string, leadId: string | undefined, result: { ok: boolean; output: string }) {
  try {
    const session = await getSession();
    if (session) await insertAgentRunDb(session.agencyId, leadId ?? null, command, result.ok, result.output);
  } catch { /* non-blocking */ }
}

export async function runEnricherAction(limit: number, leadId?: string) {
  const args = leadId ? ["--lead-id", leadId] : ["--limit", String(limit)];
  const result = await runAgentCommand("enrich", args);
  await logRun("enrich", leadId, result);
  refreshAll(leadId);
  return result;
}

export async function runDmEnrichAction(limit: number, leadId?: string) {
  const args = leadId ? ["--lead-id", leadId] : ["--limit", String(limit)];
  const result = await runAgentCommand("enrich-dm", args);
  await logRun("enrich-dm", leadId, result);
  refreshAll(leadId);
  return result;
}

export async function runIcpScoreAction(limit: number, leadId?: string) {
  const args = leadId ? ["--lead-id", leadId] : ["--limit", String(limit)];
  const result = await runAgentCommand("icp-score", args);
  await logRun("icp-score", leadId, result);
  refreshAll(leadId);
  return result;
}

export async function runQualifierAction(limit: number, leadId?: string) {
  const args = leadId ? ["--lead-id", leadId] : ["--limit", String(limit)];
  const result = await runAgentCommand("qualify", args);
  await logRun("qualify", leadId, result);
  refreshAll(leadId);
  return result;
}

export async function runOutreachAction(limit: number, leadId?: string, signatureId?: string) {
  const args = leadId ? ["--lead-id", leadId] : ["--limit", String(limit)];
  if (signatureId) args.push("--signature-id", signatureId);
  const result = await runAgentCommand("outreach", args);
  await logRun("outreach", leadId, result);
  refreshAll(leadId);
  return result;
}

export async function createSignatureAction(label: string, body: string, isDefault: boolean) {
  const row = await insertSignatureDb(label, body, isDefault);
  revalidatePath("/outreach");
  return { ok: Boolean(row), signature: row };
}

export async function updateSignatureAction(id: string, label: string, body: string) {
  const row = await updateSignatureDb(id, label, body);
  revalidatePath("/outreach");
  return { ok: Boolean(row) };
}

export async function setDefaultSignatureAction(id: string) {
  const row = await setDefaultSignatureDb(id);
  revalidatePath("/outreach");
  return { ok: Boolean(row) };
}

export async function deleteSignatureAction(id: string) {
  const row = await deleteSignatureDb(id);
  revalidatePath("/outreach");
  return { ok: Boolean(row) };
}

export async function runSequencerAction() {
  const result = await runAgentCommand("sequence", ["--run-now"]);
  refreshAll();
  return result;
}

export async function runFullPipelineAction() {
  const result = await runAgentCommand("daily", []);
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

export async function sendProposalAction(proposalId: string) {
  const result = await runAgentCommand("send-proposal", ["--proposal-id", proposalId]);
  refreshAll();
  return result;
}

export async function generateTelegramLinkCodeAction(): Promise<{ ok: boolean; code?: string }> {
  const session = await getSession();
  if (!session) return { ok: false };
  const code = await generateTelegramLinkCodeDb(session.id, session.agencyId);
  return { ok: true, code };
}

export async function updateTelegramNotificationLevelAction(level: string) {
  const session = await getSession();
  if (!session) return { ok: false };
  await updateTelegramNotificationLevelDb(session.id, level);
  revalidatePath("/settings");
  return { ok: true };
}

export async function unlinkTelegramAction() {
  const session = await getSession();
  if (!session) return { ok: false };
  await unlinkTelegramDb(session.id);
  revalidatePath("/settings");
  return { ok: true };
}

export async function archiveLeadAction(leadId: string) {
  const row = await archiveLeadDb(leadId);
  refreshAll(leadId);
  return { ok: Boolean(row) };
}

export async function updatePipelineAction(
  leadId: string,
  fields: {
    pipelineStage?: string;
    nextAction?: string | null;
    nextActionDue?: string | null;
    dealValue?: number | null;
    dealCurrency?: string | null;
  }
) {
  const row = await updatePipelineDb(leadId, fields);
  refreshAll();
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/deals");
  return { ok: Boolean(row) };
}

export async function convertToDealAction(
  leadId: string,
  dealValue: number | null,
  dealCurrency: string,
  stage: string,
): Promise<{ ok: boolean; error?: string }> {
  const DEAL_STAGES = ["Qualified", "Proposal Sent", "Negotiating"];
  if (!DEAL_STAGES.includes(stage)) return { ok: false, error: "Invalid stage." };
  const row = await updatePipelineDb(leadId, {
    pipelineStage: stage,
    dealValue: dealValue || null,
    dealCurrency: dealCurrency || null,
  });
  refreshAll();
  revalidatePath("/deals");
  revalidatePath("/opportunities");
  return { ok: Boolean(row) };
}

export async function sendDirectReplyAction(
  leadId: string,
  toEmail: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured." };

  const from = process.env.EMAIL_FROM ?? "Tedmark Digital <contact@tedmarkdigital.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [toEmail], subject, text: body }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    return { ok: false, error: `Email failed: ${err}` };
  }

  await sendDirectReplyDb(leadId, subject, body);
  revalidatePath("/conversations");
  return { ok: true };
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

export async function setScoutEnabledAction(enabled: boolean) {
  try {
    await setSetting("scout_enabled", enabled);
    revalidatePath("/agents");
    revalidatePath("/settings");
    return { ok: true, output: enabled ? "Scout resumed." : "Scout stopped." };
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : "Could not update Scout." };
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
