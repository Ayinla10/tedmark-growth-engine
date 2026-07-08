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
} from "./mutations";

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
