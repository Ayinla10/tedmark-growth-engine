import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { complete } from '../tools/llm.js';
import { fetchUnseenMessages } from '../tools/inboxClient.js';
import { extractSenderEmail, isAutomatedSender, stripQuotedReply } from '../tools/inboxParsing.js';
import {
  findLeadByEmail,
  replyExistsForMessageId,
  insertAutoReply,
  getLatestOutreachForLead,
  insertOutreach,
} from '../tools/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'classify-reply.md'), 'utf-8');
}

function parseClassifyResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.classification !== 'string') {
    throw new Error('Response missing classification');
  }

  return parsed;
}

export async function runReplyWatcher() {
  console.log('[reply-watcher] Checking contact@tedmarkdigital.com for new replies...');

  const messages = await fetchUnseenMessages();
  if (messages.length === 0) {
    console.log('[reply-watcher] No new messages.');
    return;
  }

  console.log(`[reply-watcher] Found ${messages.length} unseen message(s).`);
  const systemPrompt = await loadPrompt();

  for (const msg of messages) {
    const senderEmail = extractSenderEmail(msg.from);

    if (isAutomatedSender(senderEmail)) {
      console.log(`[reply-watcher] Skipping automated sender: ${msg.from}`);
      continue;
    }

    if (await replyExistsForMessageId(msg.messageId)) {
      console.log(`[reply-watcher] Already processed message ${msg.messageId}, skipping.`);
      continue;
    }

    const lead = senderEmail ? await findLeadByEmail(senderEmail) : null;
    if (!lead) {
      console.log(`[reply-watcher] No matching lead for ${senderEmail ?? msg.from}. Leaving unclassified.`);
      await insertAutoReply({
        leadId: null,
        outreachId: null,
        body: stripQuotedReply(msg.text),
        fromEmail: senderEmail,
        messageId: msg.messageId,
        classification: 'other',
      }).catch(() => {
        // No lead_id to attach to (replies.lead_id is NOT NULL) — log and move on
        console.warn(`[reply-watcher] Could not store unmatched reply from ${senderEmail}.`);
      });
      continue;
    }

    const latestOutreach = await getLatestOutreachForLead(lead.id);
    const replyText = stripQuotedReply(msg.text);

    const userMessage = [
      `Original outreach subject: ${latestOutreach?.subject ?? '(unknown)'}`,
      `Original outreach body:\n${latestOutreach?.body ?? '(not on file)'}`,
      `---`,
      `Lead's reply:\n${replyText}`,
    ].join('\n');

    let classification = 'other';
    let draftOutreachId = null;

    try {
      // deepseek-v4-flash spends max_tokens on hidden chain-of-thought before
      // the answer — 400 left too little margin for longer replies and could
      // cut off mid-reasoning with empty content (finish_reason "length").
      const text = await complete({ system: systemPrompt, user: userMessage, maxTokens: 2000, json: true });
      const parsed = parseClassifyResponse(text);
      classification = parsed.classification;

      if (parsed.next_message) {
        const draft = await insertOutreach({
          lead_id: lead.id,
          message_type: 'email',
          subject: latestOutreach?.subject ? `Re: ${latestOutreach.subject}` : 'Re: your message',
          body: parsed.next_message,
          status: 'draft',
        });
        draftOutreachId = draft.id;
      }

      console.log(`[reply-watcher] "${lead.business_name}" reply classified as ${classification}${draftOutreachId ? ' — draft created' : ''}.`);
    } catch (err) {
      console.error(`[reply-watcher] Classification failed for "${lead.business_name}": ${err.message}`);
    }

    await insertAutoReply({
      leadId: lead.id,
      outreachId: latestOutreach?.id ?? null,
      body: replyText,
      fromEmail: senderEmail,
      messageId: msg.messageId,
      classification,
      draftOutreachId,
    });
  }

  console.log('[reply-watcher] Done.');
}
