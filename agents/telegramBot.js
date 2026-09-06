import cron from 'node-cron';
import { getUpdates, sendMessage, sendChatAction, answerCallbackQuery, editMessageReplyMarkup, setMyCommands } from '../tools/telegram.js';
import { consumeCallbackToken } from '../tools/telegramAuth.js';
import {
  consumeTelegramLinkCode,
  getTelegramLinkByChatId,
  recordTelegramMessage,
  getTelegramStatusSummary,
  getQualifiedLeads,
  getOutreachById,
  getAgencyIdsWithActiveTelegramLinks,
  query,
} from '../tools/db.js';
import { runApprove, runSend } from './outreach.js';
import { setSetting } from '../tools/settings.js';
import { notifyTelegram } from '../tools/telegramNotify.js';
import { processOwnerMessage, dispatchAgent, summariseAgentResult, loadBusinessContext } from './conversationEngine.js';

const COMMANDS = [
  { command: 'start', description: 'Connect or check your link status' },
  { command: 'link', description: 'Link your account: /link CODE' },
  { command: 'status', description: "Today's activity snapshot" },
  { command: 'leads', description: 'Top qualified leads right now' },
  { command: 'pause', description: 'Pause automated lead discovery' },
  { command: 'resume', description: 'Resume automated lead discovery' },
  { command: 'help', description: 'What can I ask?' },
];

const HELP_TEXT = [
  '*Tedmark Growth AI*',
  '',
  'Commands:',
  '/status — today\'s activity snapshot',
  '/leads — top qualified leads',
  '/pause — pause automated discovery',
  '/resume — resume automated discovery',
  '',
  'Or just ask in plain English:',
  '"how are we doing today?"',
  '"pause discovery"',
  '"show me the top leads"',
].join('\n');

function formatStatus(s) {
  return [
    '*TODAY\'S PERFORMANCE*',
    '',
    `Leads found today: ${s.leadsToday}`,
    `Total leads: ${s.leadsTotal}`,
    `Qualified: ${s.qualified}`,
    `Avg score: ${s.avgScore ?? '—'}`,
    `Outreach drafts pending: ${s.drafts}`,
    `Sent today: ${s.sentToday}`,
    `Replies: ${s.replied}`,
    `Proposals: ${s.proposals}`,
    s.dueOrOverdue > 0 ? `\n⚠️ ${s.dueOrOverdue} next-action${s.dueOrOverdue === 1 ? '' : 's'} due or overdue.` : '',
  ].filter(Boolean).join('\n');
}

async function formatAttention(agencyId) {
  const res = await query(
    `SELECT l.business_name, l.pipeline_stage, l.deal_value, l.deal_currency, l.next_action_due,
            (SELECT MAX(o.sent_at) FROM outreach o WHERE o.lead_id = l.id AND o.status = 'sent') AS last_outreach_at
     FROM leads l
     WHERE l.agency_id = $1 AND l.status != 'archived'
       AND l.pipeline_stage IN ('Qualified', 'Proposal Sent', 'Negotiating')`,
    [agencyId]
  );
  const now = Date.now();
  const DAY = 86400000;
  const flagged = res.rows
    .map(d => {
      const daysSince = d.last_outreach_at
        ? Math.floor((now - new Date(d.last_outreach_at).getTime()) / DAY)
        : null;
      const overdue = d.next_action_due && new Date(d.next_action_due) < new Date();
      let signal = null;
      if (overdue) signal = 'Action overdue';
      else if (d.pipeline_stage === 'Proposal Sent' && daysSince >= 3) signal = `${daysSince}d since proposal — follow up`;
      else if (d.pipeline_stage === 'Negotiating'   && daysSince >= 5) signal = `Stalled — ${daysSince}d no activity`;
      else if (d.pipeline_stage === 'Qualified'     && daysSince >= 7) signal = `Going cold — ${daysSince}d no contact`;
      return signal ? { ...d, signal } : null;
    })
    .filter(Boolean);

  if (!flagged.length) return '✅ Nothing needs your attention right now.';
  const lines = ['*NEEDS ATTENTION*', ''];
  for (const d of flagged) {
    const val = d.deal_value ? ` ${d.deal_currency ?? ''}${Number(d.deal_value).toLocaleString()}` : '';
    lines.push(`⚠️ *${d.business_name}*${val}\n   ${d.signal}`);
  }
  return lines.join('\n');
}

async function formatTopLeads(agencyId) {
  const leads = await getQualifiedLeads(5, 6, agencyId);
  if (leads.length === 0) return 'No qualified leads with score ≥ 6 right now.';
  const lines = ['*TOP QUALIFIED LEADS*', ''];
  for (const l of leads) {
    lines.push(`*${l.business_name}* — ${l.score}/10\n${l.score_reason ?? ''}`);
  }
  return lines.join('\n\n');
}

// ── Per-chat pending confirmation state (in-memory) ───────────────────────────
// { chatId -> { command, args } | null }
const pendingConfirmations = new Map();

// Send "typing…" and keep re-sending every 4s until the returned stop() is called
function startTyping(chatId) {
  sendChatAction(chatId, 'typing').catch(() => {});
  const interval = setInterval(() => sendChatAction(chatId, 'typing').catch(() => {}), 4000);
  return () => clearInterval(interval);
}

async function reply(link, chatId, text) {
  const safe = (text ?? '').trim();
  if (!safe) return; // Telegram rejects empty messages
  await sendMessage(chatId, safe);
  await recordTelegramMessage(link.id, 'outbound', safe);
}

async function handleCommand(link, text, chatId, agencyId) {
  const stopTyping = startTyping(chatId);
  const lower = text.toLowerCase().trim();

  try {
    // Hard slash commands — instant, no AI needed
    if (lower === '/status') {
      const summary = await getTelegramStatusSummary(agencyId);
      return await reply(link, chatId, formatStatus(summary));
    }
    if (lower === '/leads') {
      return await reply(link, chatId, await formatTopLeads(agencyId));
    }
    if (lower === '/pause') {
      await setSetting('scout_enabled', false, agencyId);
      await setSetting('web_scout_enabled', false, agencyId);
      await setSetting('directory_scout_enabled', false, agencyId);
      return await reply(link, chatId, 'Discovery paused. No new leads will be found until you say resume.');
    }
    if (lower === '/resume') {
      await setSetting('scout_enabled', true, agencyId);
      await setSetting('web_scout_enabled', true, agencyId);
      await setSetting('directory_scout_enabled', true, agencyId);
      return await reply(link, chatId, 'Discovery resumed.');
    }
    if (lower === '/help') {
      return await reply(link, chatId, HELP_TEXT);
    }

    // ── Natural language fast paths — instant DB queries, no AI needed ─────────
    if (/\b(overdue|attention|urgent|needs action|follow.?up|pull the|show the)\b/i.test(lower) &&
        /\b(overdue|attention|urgent)\b/i.test(lower)) {
      return await reply(link, chatId, await formatAttention(agencyId));
    }
    if (/\b(status|report|how are we|how.?s it going|today|summary|current report)\b/i.test(lower)) {
      const s = await getTelegramStatusSummary(agencyId);
      return await reply(link, chatId, formatStatus(s));
    }
    if (/\b(top leads?|best leads?|qualified leads?|show leads?)\b/i.test(lower)) {
      return await reply(link, chatId, await formatTopLeads(agencyId));
    }
    // "try again" / "again" with no pending → show status as a useful default
    if (/^(try again|again|retry|repeat)$/i.test(lower)) {
      const s = await getTelegramStatusSummary(agencyId);
      return await reply(link, chatId, formatStatus(s));
    }

    // ── Intelligent conversation engine ────────────────────────────────────────
    const pending = pendingConfirmations.get(chatId) ?? null;

    const result = await processOwnerMessage({
      text,
      linkId: link.id,
      agencyId,
      pendingConfirmation: pending,
    });

    // Update pending state
    if (result.clearPending || result.dispatch) pendingConfirmations.delete(chatId);
    if (result.setPending) pendingConfirmations.set(chatId, result.setPending);

    // Send the immediate reply — stop typing before sending
    stopTyping();
    await reply(link, chatId, result.reply);

    // If AI generated a draft (e.g. a suggested message), send it as a follow-up
    if (result.draft) {
      await reply(link, chatId, result.draft);
    }

    // If there's a dispatch, restart typing, run the agent, report back
    if (result.dispatch) {
      const { command, args } = result.dispatch;
      const stopAgentTyping = startTyping(chatId);
      try {
        const agentResult = await dispatchAgent(command, args);
        const bizCtx = await loadBusinessContext(agencyId).catch(() => '');
        stopAgentTyping();
        if (agentResult.ok) {
          const summary = await summariseAgentResult(command, agentResult.output, bizCtx);
          await reply(link, chatId, summary);
        } else {
          await reply(link, chatId, `The ${command} agent ran into a problem: ${agentResult.output || 'unknown error'}`);
        }
      } catch (err) {
        stopAgentTyping();
        await reply(link, chatId, `I couldn't reach the ${command} agent: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('[telegram] handleCommand error:', err?.message ?? err, err?.stack ?? '');
    // Graceful degradation — never show a raw error to the owner
    const s = await getTelegramStatusSummary(agencyId).catch(() => null);
    const fallback = s
      ? `Here's what I know right now:\n${formatStatus(s)}`
      : "Something went wrong on my end. Send /status for a quick summary.";
    await reply(link, chatId, fallback).catch(() => {});
  } finally {
    stopTyping();
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text ?? '').trim();

  const link = await getTelegramLinkByChatId(chatId);

  if (text.startsWith('/link ')) {
    const code = text.slice(6).trim().toUpperCase();
    const newLink = await consumeTelegramLinkCode(code, chatId, msg.from.id, msg.from.username);
    if (!newLink) {
      await sendMessage(chatId, "That code is invalid or expired. Generate a new one with: `node index.js telegram-link`");
      return;
    }
    await sendMessage(chatId, "✅ Linked! Send /status anytime, or just ask me how things are going.");
    return;
  }

  if (text === '/start') {
    if (link) {
      await sendMessage(chatId, `Already connected. Send /help to see what I can do.`);
    } else {
      await sendMessage(
        chatId,
        "Hi — I'm the Tedmark Growth AI bot.\n\nTo connect this chat to your account, run this on your computer:\n`node index.js telegram-link`\n\nThen send me: `/link CODE`"
      );
    }
    return;
  }

  if (!link) {
    await sendMessage(chatId, "This chat isn't linked yet. Run `node index.js telegram-link` and then send me `/link CODE`.");
    return;
  }

  await recordTelegramMessage(link.id, 'inbound', text);
  await handleCommand(link, text, chatId, link.agency_id);
}

async function handleCallbackQuery(cb) {
  const chatId = cb.message.chat.id;
  const link = await getTelegramLinkByChatId(chatId);

  if (!link) {
    await answerCallbackQuery(cb.id, 'Not linked.');
    return;
  }

  const payload = await consumeCallbackToken(cb.data, link.id);
  if (!payload) {
    await answerCallbackQuery(cb.id, 'This action has expired or was already used.');
    return;
  }

  await editMessageReplyMarkup(chatId, cb.message.message_id);

  if (payload.action === 'approve_outreach') {
    const outreach = await getOutreachById(payload.target_id);
    if (!outreach || outreach.status !== 'draft') {
      await answerCallbackQuery(cb.id, 'No longer pending.');
      await sendMessage(chatId, 'That draft is no longer pending approval — it may have already been handled elsewhere.');
      return;
    }

    await runApprove({ outreachId: payload.target_id });
    await answerCallbackQuery(cb.id, 'Approved');

    if (outreach.message_type === 'email') {
      await runSend({ outreachId: payload.target_id });
      await sendMessage(chatId, `✅ Approved and sent to "${outreach.business_name}".`);
    } else {
      await sendMessage(chatId, `✅ Approved. This is a WhatsApp message — open the dashboard to send it (no automated WhatsApp sending yet).`);
    }
  } else if (payload.action === 'reject_outreach') {
    await answerCallbackQuery(cb.id, 'Rejected');
    await sendMessage(chatId, `Rejected. I won't send this message.`);
  } else {
    await answerCallbackQuery(cb.id, 'Unknown action.');
  }
}

async function sendDailyReports() {
  const agencyIds = await getAgencyIdsWithActiveTelegramLinks();
  for (const agencyId of agencyIds) {
    try {
      const s = await getTelegramStatusSummary(agencyId);
      const report = [
        '*DAILY REPORT*',
        '',
        `Leads found today: ${s.leadsToday}`,
        `Outreach sent today: ${s.sentToday}`,
        `Outreach drafts pending approval: ${s.drafts}`,
        `Replies: ${s.replied}`,
        `Proposals: ${s.proposals}`,
        s.dueOrOverdue > 0 ? `\n⚠️ ${s.dueOrOverdue} next-action${s.dueOrOverdue === 1 ? '' : 's'} due or overdue.` : '',
      ].filter(Boolean).join('\n');
      await notifyTelegram(agencyId, 'INFO', report);
    } catch (err) {
      console.error(`[telegram-bot] Daily report failed for agency ${agencyId}: ${err.message}`);
    }
  }
}

export async function runTelegramBot() {
  console.log('[telegram-bot] Setting bot commands...');
  await setMyCommands(COMMANDS).catch((err) => console.warn(`[telegram-bot] Could not set commands: ${err.message}`));

  console.log('[telegram-bot] Scheduling daily report at 18:00...');
  cron.schedule('0 18 * * *', () => {
    sendDailyReports().catch((err) => console.error('[telegram-bot] Daily report run failed:', err));
  });

  console.log('[telegram-bot] Starting long-poll loop. Press Ctrl+C to stop.');
  let offset = 0;

  while (true) {
    let updates;
    try {
      updates = await getUpdates(offset, 30);
    } catch (err) {
      console.error(`[telegram-bot] getUpdates failed: ${err.message}. Retrying in 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;
      try {
        if (update.message) {
          await handleMessage(update.message);
        } else if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
        }
      } catch (err) {
        console.error(`[telegram-bot] Failed to handle update ${update.update_id}: ${err.message}`);
      }
    }
  }
}
