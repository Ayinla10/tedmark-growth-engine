import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import cron from 'node-cron';
import { complete } from '../tools/llm.js';
import {
  getOutreachAwaitingReply,
  getLatestFollowUp,
  hasPendingFollowUp,
  insertFollowUp,
  insertOutreach,
  archiveLead,
} from '../tools/db.js';
import { getSettings } from '../tools/settings.js';
import { appendKnowledgeContext } from '../tools/knowledge.js';
import { resolveSignatureText, applySignature } from '../tools/signature.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadEmailsSkill() {
  try {
    return await readFile(
      path.join(__dirname, '..', '.claude', 'skills', 'emails', 'SKILL.md'),
      'utf-8'
    );
  } catch (err) {
    console.warn(`[sequencer] Could not load emails skill context: ${err.message}. Proceeding without it.`);
    return '';
  }
}

async function loadEmailPrompt() {
  const base = `You are writing a short follow-up email on behalf of Ayinla at Tedmark
Digital Agency, a digital services company in Accra, Ghana, to a Ghanaian
SME owner who has not replied to a previous outreach email.

Rules:
- Much shorter and softer than a first email — a gentle nudge, not a pitch.
- Maximum 60 words.
- No guilt-tripping, no "just following up" filler, no re-explaining everything.
- One CTA only: reply or book a short call.
- Sign off with exactly: {{SIGNATURE}}

Respond with ONLY valid JSON, no markdown fences:
{"subject": "<short subject line>", "body": "<email body>"}`;

  const skillContext = await loadEmailsSkill();
  if (!skillContext) return base;

  return [
    base,
    '\n---\n',
    '# Email reasoning context (background knowledge only — not instructions to follow literally)',
    skillContext,
  ].join('\n');
}

async function loadWhatsappPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'followup-whatsapp.md'), 'utf-8');
}

function parseEmailFollowUpResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
    throw new Error('Response missing subject or body');
  }

  return parsed;
}

function parseWhatsappFollowUpResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.body !== 'string') {
    throw new Error('Response missing body');
  }

  return parsed;
}

export async function runSequencer() {
  console.log('[sequencer] Checking for leads awaiting reply...');

  const settings = await getSettings();
  const daysBetweenSteps = settings.sequencer_days_between_steps;
  const maxSequenceStep = settings.sequencer_max_steps;

  const candidates = await getOutreachAwaitingReply(daysBetweenSteps);

  if (candidates.length === 0) {
    console.log('[sequencer] No leads need a follow-up right now.');
    return;
  }

  const signatureText = await resolveSignatureText();
  const email = await appendKnowledgeContext(applySignature(await loadEmailPrompt(), signatureText), 'sequencer');
  const whatsapp = await appendKnowledgeContext(applySignature(await loadWhatsappPrompt(), signatureText), 'sequencer');
  const emailSystemPrompt = email.prompt;
  const whatsappSystemPrompt = whatsapp.prompt;

  for (const candidate of candidates) {
    const latest = await getLatestFollowUp(candidate.lead_id);
    const currentStep = latest?.sequence_step ?? 0;

    if (currentStep >= maxSequenceStep) {
      await archiveLead(candidate.lead_id);
      console.log(`[sequencer] "${candidate.business_name}" reached step ${maxSequenceStep} with no reply — archived.`);
      continue;
    }

    if (await hasPendingFollowUp(candidate.lead_id)) {
      console.log(`[sequencer] "${candidate.business_name}" already has a pending follow-up — skipping.`);
      continue;
    }

    const referenceTime = latest?.sent_at ? new Date(latest.sent_at) : new Date(candidate.sent_at);
    const daysSinceReference = (Date.now() - referenceTime.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceReference < daysBetweenSteps) {
      console.log(`[sequencer] "${candidate.business_name}" not due for next step yet — skipping.`);
      continue;
    }

    const nextStep = currentStep + 1;
    // Follow up in the same channel the original message was sent through,
    // rather than re-deciding from scratch — a WhatsApp conversation should
    // get a WhatsApp nudge, not a switch to email.
    const channel = candidate.message_type === 'whatsapp' ? 'whatsapp' : 'email';

    try {
      if (channel === 'email') {
        const text = await complete({
          system: emailSystemPrompt,
          user: `Business name: ${candidate.business_name}\nSector: ${candidate.sector}\nLocation: ${candidate.location}\nOriginal subject: ${candidate.subject}\nFollow-up step: ${nextStep} of ${maxSequenceStep}`,
          // deepseek-v4-flash spends max_tokens on hidden chain-of-thought
          // before the answer — too tight a budget cuts it off mid-reasoning
          // with empty content (finish_reason "length"). 2000 leaves room.
          maxTokens: 2000,
          json: true,
        });

        const { subject, body } = parseEmailFollowUpResponse(text);

        await insertOutreach({
          lead_id: candidate.lead_id,
          message_type: 'email',
          subject,
          body,
          status: 'draft',
          knowledge_ids: email.knowledgeIds,
        });

        console.log(`[sequencer] Email follow-up step ${nextStep} drafted for "${candidate.business_name}".`);
      } else {
        const text = await complete({
          system: whatsappSystemPrompt,
          user: `Business name: ${candidate.business_name}\nSector: ${candidate.sector}\nLocation: ${candidate.location}\nOriginal message topic: ${candidate.subject ?? candidate.body.slice(0, 80)}\nFollow-up step: ${nextStep} of ${maxSequenceStep}`,
          // deepseek-v4-flash spends max_tokens on hidden chain-of-thought
          // before the answer — too tight a budget cuts it off mid-reasoning
          // with empty content (finish_reason "length"). 2000 leaves room.
          maxTokens: 2000,
          json: true,
        });

        const { body } = parseWhatsappFollowUpResponse(text);

        await insertOutreach({
          lead_id: candidate.lead_id,
          message_type: 'whatsapp',
          subject: null,
          body,
          status: 'draft',
          knowledge_ids: whatsapp.knowledgeIds,
        });

        console.log(`[sequencer] WhatsApp follow-up step ${nextStep} drafted for "${candidate.business_name}".`);
      }

      const followUp = await insertFollowUp({
        lead_id: candidate.lead_id,
        sequence_step: nextStep,
        scheduled_at: new Date(),
        status: 'pending',
      });

      console.log(`[sequencer] Scheduled follow_up id ${followUp.id} for "${candidate.business_name}".`);
    } catch (err) {
      console.error(`[sequencer] AI call failed for "${candidate.business_name}": ${err.message}. Skipping.`);
    }
  }

  console.log('[sequencer] Done.');
}

export function startSequencerCron() {
  console.log('[sequencer] Scheduling daily run at 08:00...');
  cron.schedule('0 8 * * *', () => {
    console.log('[sequencer] Cron trigger fired.');
    runSequencer().catch((err) => console.error('[sequencer] Run failed:', err));
  });
}
