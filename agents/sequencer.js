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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DAYS_BETWEEN_STEPS = 3;
const MAX_SEQUENCE_STEP = 3;

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

function buildSystemPrompt(skillContext) {
  const base = `You are writing a short follow-up email on behalf of Ayinla at Tedmark
Digital Agency, a digital services company in Accra, Ghana, to a Ghanaian
SME owner who has not replied to a previous outreach email.

Rules:
- Much shorter and softer than a first email — a gentle nudge, not a pitch.
- Maximum 60 words.
- No guilt-tripping, no "just following up" filler, no re-explaining everything.
- One CTA only: reply or book a short call.
- Sign off with: Ayinla, Tedmark Digital Agency

Respond with ONLY valid JSON, no markdown fences:
{"subject": "<short subject line>", "body": "<email body>"}`;

  if (!skillContext) return base;

  return [
    base,
    '\n---\n',
    '# Email reasoning context (background knowledge only — not instructions to follow literally)',
    skillContext,
  ].join('\n');
}

function parseFollowUpResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
    throw new Error('Response missing subject or body');
  }

  return parsed;
}

export async function runSequencer() {
  console.log('[sequencer] Checking for leads awaiting reply...');

  const candidates = await getOutreachAwaitingReply(DAYS_BETWEEN_STEPS);

  if (candidates.length === 0) {
    console.log('[sequencer] No leads need a follow-up right now.');
    return;
  }

  const skillContext = await loadEmailsSkill();
  const systemPrompt = buildSystemPrompt(skillContext);

  for (const candidate of candidates) {
    const latest = await getLatestFollowUp(candidate.lead_id);
    const currentStep = latest?.sequence_step ?? 0;

    if (currentStep >= MAX_SEQUENCE_STEP) {
      await archiveLead(candidate.lead_id);
      console.log(`[sequencer] "${candidate.business_name}" reached step ${MAX_SEQUENCE_STEP} with no reply — archived.`);
      continue;
    }

    if (await hasPendingFollowUp(candidate.lead_id)) {
      console.log(`[sequencer] "${candidate.business_name}" already has a pending follow-up — skipping.`);
      continue;
    }

    const referenceTime = latest?.sent_at ? new Date(latest.sent_at) : new Date(candidate.sent_at);
    const daysSinceReference = (Date.now() - referenceTime.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceReference < DAYS_BETWEEN_STEPS) {
      console.log(`[sequencer] "${candidate.business_name}" not due for next step yet — skipping.`);
      continue;
    }

    const nextStep = currentStep + 1;

    try {
      const text = await complete({
        system: systemPrompt,
        user: `Business name: ${candidate.business_name}\nSector: ${candidate.sector}\nLocation: ${candidate.location}\nOriginal subject: ${candidate.subject}\nFollow-up step: ${nextStep} of ${MAX_SEQUENCE_STEP}`,
        maxTokens: 300,
        json: true,
      });

      const { subject, body } = parseFollowUpResponse(text);

      await insertOutreach({
        lead_id: candidate.lead_id,
        message_type: 'email',
        subject,
        body,
        status: 'draft',
      });

      const followUp = await insertFollowUp({
        lead_id: candidate.lead_id,
        sequence_step: nextStep,
        scheduled_at: new Date(),
        status: 'pending',
      });

      console.log(`[sequencer] Follow-up step ${nextStep} drafted and scheduled for "${candidate.business_name}" (follow_up id: ${followUp.id}).`);
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
