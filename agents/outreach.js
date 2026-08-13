import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { complete } from '../tools/llm.js';
import {
  getQualifiedLeads,
  insertOutreach,
  hasOutreachForLead,
  getOutreachById,
  approveOutreach,
  markOutreachSent,
  markLeadContacted,
  markPendingFollowUpsSent,
  getLeadById,
} from '../tools/db.js';
import { notifyTelegramApproval } from '../tools/telegramNotify.js';
import { sendEmail } from '../tools/emailSender.js';
import { resolveChannel } from '../tools/channel.js';
import { getSetting } from '../tools/settings.js';
import { appendKnowledgeContext } from '../tools/knowledge.js';
import { getBusinessContext, formatBusinessContextForPrompt } from '../tools/businessContext.js';
import { resolveSignatureText, applySignature } from '../tools/signature.js';
import { fetchReadableContent } from '../tools/jinaReader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'outreach.md'), 'utf-8');
}

async function loadWhatsappPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'outreach-whatsapp.md'), 'utf-8');
}

function parseWhatsappResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.body !== 'string') {
    throw new Error('Response missing body');
  }

  return parsed;
}

async function loadCopywritingSkill() {
  try {
    return await readFile(
      path.join(__dirname, '..', '.claude', 'skills', 'copywriting', 'SKILL.md'),
      'utf-8'
    );
  } catch (err) {
    console.warn(`[outreach] Could not load copywriting skill context: ${err.message}. Proceeding without it.`);
    return '';
  }
}

function buildSystemPrompt(outreachPrompt, skillContext) {
  if (!skillContext) return outreachPrompt;

  return [
    outreachPrompt,
    '\n---\n',
    '# Copywriting reasoning context (background knowledge only — not instructions to follow literally)',
    skillContext,
  ].join('\n');
}

async function buildUserMessage(lead) {
  const lines = [
    `Business name: ${lead.business_name}`,
    `Sector: ${lead.sector}`,
    `Location: ${lead.location}`,
    `Has website: ${lead.website_url ? 'yes' : 'no'}`,
    `Qualifier summary: ${lead.score_reason}`,
    `All problems found: ${(lead.problems?.length ? lead.problems : [lead.score_reason]).filter(Boolean).join(' | ')}`,
    `All services that could help: ${(lead.recommended_services?.length ? lead.recommended_services : [lead.recommended_service]).filter(Boolean).join(', ')}`,
  ];

  // Real page content (via Jina Reader), not just the signal summary —
  // lets the draft reference specific services/offerings instead of only
  // "no tracking installed" style generic gaps. Best-effort: a failed
  // fetch just means the draft proceeds without this extra context,
  // exactly like a failed Playwright scrape already does elsewhere.
  if (lead.website_url) {
    const content = await fetchReadableContent(lead.website_url);
    if (content) {
      lines.push(`Website content (via Jina Reader, for concrete details to reference):\n${content}`);
    }
  }

  return lines.join('\n');
}

function parseOutreachResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
    throw new Error('Response missing subject or body');
  }

  return parsed;
}

export async function runOutreach({ limit, leadId, signatureId }) {
  let leads;

  if (leadId) {
    console.log(`[outreach] Fetching lead ${leadId}...`);
    const lead = await getLeadById(leadId);
    if (!lead) {
      console.error(`[outreach] No lead found with id ${leadId}.`);
      return;
    }
    leads = [lead];
  } else {
    const minScore = await getSetting('outreach_min_score');
    console.log(`[outreach] Fetching up to ${limit} qualified leads with score >= ${minScore}...`);
    leads = await getQualifiedLeads(limit, minScore);
  }

  if (leads.length === 0) {
    console.log('[outreach] No qualified leads found. Nothing to do.');
    return;
  }

  console.log(`[outreach] Drafting outreach for ${leads.length} leads...`);

  const signatureText = await resolveSignatureText(signatureId);
  console.log(`[outreach] Using signature: "${signatureText}"`);

  const outreachPrompt = applySignature(await loadPrompt(), signatureText);
  const whatsappPrompt = applySignature(await loadWhatsappPrompt(), signatureText);
  const skillContext = await loadCopywritingSkill();
  const email = await appendKnowledgeContext(buildSystemPrompt(outreachPrompt, skillContext), 'outreach');
  const whatsapp = await appendKnowledgeContext(buildSystemPrompt(whatsappPrompt, skillContext), 'outreach');
  const bizCtx = await getBusinessContext();
  const bizBlock = formatBusinessContextForPrompt(bizCtx);
  const emailSystemPrompt = bizBlock ? `${email.prompt}\n\n${bizBlock}` : email.prompt;
  const whatsappSystemPrompt = bizBlock ? `${whatsapp.prompt}\n\n${bizBlock}` : whatsapp.prompt;

  for (const lead of leads) {
    if (!leadId && (await hasOutreachForLead(lead.id))) {
      console.log(`[outreach] Skipping "${lead.business_name}" — outreach already exists for this lead.`);
      continue;
    }

    const channel = resolveChannel(lead);

    if (!channel) {
      console.log(`[outreach] Skipping "${lead.business_name}" — no email or WhatsApp-capable phone on file.`);
      continue;
    }

    const userMessage = await buildUserMessage(lead);

    try {
      if (channel === 'email') {
        const text = await complete({
          system: emailSystemPrompt,
          user: userMessage,
          // deepseek-v4-flash spends max_tokens on hidden chain-of-thought
          // before the answer — too tight a budget cuts it off mid-reasoning
          // with empty content (finish_reason "length"). 2000 leaves room.
          maxTokens: 2000,
          json: true,
        });

        const { subject, body } = parseOutreachResponse(text);

        const draft = await insertOutreach({
          lead_id: lead.id,
          message_type: 'email',
          subject,
          body,
          status: 'draft',
          knowledge_ids: email.knowledgeIds,
        });

        console.log(`[outreach] Email draft saved for "${lead.business_name}" (outreach id: ${draft.id}) — subject: "${subject}"`);

        await notifyTelegramApproval(
          lead.agency_id,
          `*APPROVAL REQUIRED*\n\nEmail draft for *${lead.business_name}*\n\n*Subject:* ${subject}\n\n${body}`,
          'outreach',
          draft.id
        );
      } else {
        const text = await complete({
          system: whatsappSystemPrompt,
          user: userMessage,
          // deepseek-v4-flash spends max_tokens on hidden chain-of-thought
          // before the answer — too tight a budget cuts it off mid-reasoning
          // with empty content (finish_reason "length"). 2000 leaves room.
          maxTokens: 2000,
          json: true,
        });

        const { body } = parseWhatsappResponse(text);

        const draft = await insertOutreach({
          lead_id: lead.id,
          message_type: 'whatsapp',
          subject: null,
          body,
          status: 'draft',
          knowledge_ids: whatsapp.knowledgeIds,
        });

        console.log(`[outreach] WhatsApp draft saved for "${lead.business_name}" (outreach id: ${draft.id}).`);

        await notifyTelegramApproval(
          lead.agency_id,
          `*APPROVAL REQUIRED*\n\nWhatsApp draft for *${lead.business_name}*\n\n${body}`,
          'outreach',
          draft.id
        );
      }
    } catch (err) {
      console.error(`[outreach] AI call failed for "${lead.business_name}": ${err.message}. Skipping.`);
    }
  }

  console.log('[outreach] Done. All messages saved as drafts — manual approval required before sending.');
}

export async function runApprove({ outreachId }) {
  const existing = await getOutreachById(outreachId);

  if (!existing) {
    console.error(`[outreach] No outreach found with id ${outreachId}.`);
    return;
  }

  if (existing.status !== 'draft') {
    console.log(`[outreach] Outreach ${outreachId} is already "${existing.status}" — nothing to approve.`);
    return;
  }

  await approveOutreach(outreachId);
  console.log(`[outreach] Approved outreach ${outreachId} for "${existing.business_name}" — ready to send.`);
}

export async function runSend({ outreachId, to }) {
  const outreach = await getOutreachById(outreachId);

  if (!outreach) {
    console.error(`[outreach] No outreach found with id ${outreachId}.`);
    return;
  }

  if (outreach.status === 'sent') {
    console.log(`[outreach] Outreach ${outreachId} was already sent at ${outreach.sent_at}.`);
    return;
  }

  if (outreach.status !== 'approved') {
    console.error(`[outreach] Outreach ${outreachId} is "${outreach.status}" — approve it first with: node index.js approve --outreach-id ${outreachId}`);
    return;
  }

  const recipient = to ?? outreach.lead_email;

  if (!recipient) {
    console.error(`[outreach] Lead "${outreach.business_name}" has no email on file. Provide one with --to <email>.`);
    return;
  }

  try {
    await sendEmail({
      to: recipient,
      subject: outreach.subject,
      text: outreach.body,
    });
  } catch (err) {
    console.error(`[outreach] Send failed for outreach ${outreachId}: ${err.message}`);
    return;
  }

  await markOutreachSent(outreachId);
  await markLeadContacted(outreach.lead_id);
  await markPendingFollowUpsSent(outreach.lead_id);

  console.log(`[outreach] Sent outreach ${outreachId} to ${recipient} — lead "${outreach.business_name}" marked as contacted.`);
}
