import cron from 'node-cron';
import { getUpdates, sendMessage, answerCallbackQuery, editMessageReplyMarkup, setMyCommands } from '../tools/telegram.js';
import { consumeCallbackToken } from '../tools/telegramAuth.js';
import {
  consumeTelegramLinkCode,
  getTelegramLinkByChatId,
  recordTelegramMessage,
  getTelegramStatusSummary,
  getQualifiedLeads,
  getOutreachById,
  getAgencyIdsWithActiveTelegramLinks,
} from '../tools/db.js';
import { runApprove, runSend } from './outreach.js';
import { setSetting } from '../tools/settings.js';
import { complete } from '../tools/llm.js';
import { notifyTelegram } from '../tools/telegramNotify.js';

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

async function formatTopLeads(agencyId) {
  const leads = await getQualifiedLeads(5, 6, agencyId);
  if (leads.length === 0) return 'No qualified leads with score ≥ 6 right now.';
  const lines = ['*TOP QUALIFIED LEADS*', ''];
  for (const l of leads) {
    lines.push(`*${l.business_name}* — ${l.score}/10\n${l.score_reason ?? ''}`);
  }
  return lines.join('\n\n');
}

// A small, closed set of intents — natural language is classified into
// one of these, never executed directly. Matches the spec's own security
// principle: NL message -> structured intent -> authorization -> execution,
// not "let the model decide what code to run."
const INTENTS = ['status', 'leads', 'pause', 'resume', 'help', 'unknown'];

async function classifyIntent(text) {
  try {
    const raw = await complete({
      system: `Classify the user's message into exactly one of these intents: ${INTENTS.join(', ')}. Respond with ONLY the intent word, nothing else.`,
      user: text,
      maxTokens: 500,
    });
    const intent = raw.trim().toLowerCase();
    return INTENTS.includes(intent) ? intent : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function reply(link, chatId, text) {
  await sendMessage(chatId, text);
  await recordTelegramMessage(link.id, 'outbound', text);
}

async function handleCommand(link, intent, chatId, agencyId) {
  if (intent === 'status') {
    const summary = await getTelegramStatusSummary(agencyId);
    await reply(link, chatId, formatStatus(summary));
  } else if (intent === 'leads') {
    await reply(link, chatId, await formatTopLeads(agencyId));
  } else if (intent === 'pause') {
    await setSetting('scout_enabled', false, agencyId);
    await setSetting('web_scout_enabled', false, agencyId);
    await setSetting('directory_scout_enabled', false, agencyId);
    await reply(link, chatId, 'Discovery paused. No new leads will be found until you /resume.');
  } else if (intent === 'resume') {
    await setSetting('scout_enabled', true, agencyId);
    await setSetting('web_scout_enabled', true, agencyId);
    await setSetting('directory_scout_enabled', true, agencyId);
    await reply(link, chatId, 'Discovery resumed.');
  } else if (intent === 'help') {
    await reply(link, chatId, HELP_TEXT);
  } else {
    await reply(link, chatId, "I didn't understand that. Send /help to see what I can do.");
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

  let intent;
  if (text.startsWith('/')) {
    intent = text.slice(1).split(' ')[0].toLowerCase();
    if (!INTENTS.includes(intent)) intent = 'unknown';
  } else {
    intent = await classifyIntent(text);
  }

  await handleCommand(link, intent, chatId, link.agency_id);
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
