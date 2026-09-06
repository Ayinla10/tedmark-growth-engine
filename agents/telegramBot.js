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

// ── Agent dispatch ─────────────────────────────────────────────────────────────
const AGENT_REGISTRY = {
  scout:         { description: 'Find new leads from Google Maps by sector and city', args: ['sector', 'city', 'limit'] },
  'web-scout':   { description: 'Find leads by searching the web', args: ['sector', 'city', 'limit'] },
  enrich:        { description: 'Enrich existing leads with contact info (email, phone, website)', args: [] },
  'enrich-dm':   { description: 'Find decision maker names and titles for leads', args: [] },
  qualify:       { description: 'Score and qualify leads using AI', args: [] },
  'icp-score':   { description: 'Run ICP scoring on leads', args: [] },
  outreach:      { description: 'Generate outreach email drafts for qualified leads', args: [] },
  send:          { description: 'Send approved outreach emails', args: [] },
  analytics:     { description: 'Run analytics and generate performance report', args: [] },
  daily:         { description: 'Run the full daily pipeline (scout → enrich → qualify → outreach)', args: [] },
};

const SERVER_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || 'http://localhost:4000';
const API_SECRET = process.env.RENDER_API_SECRET;

async function dispatchAgent(command, args = {}) {
  const res = await fetch(`${SERVER_URL}/run/${command}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ args }),
  });
  const data = await res.json();
  return data;
}

async function classifyDispatch(text) {
  const agentList = Object.entries(AGENT_REGISTRY)
    .map(([k, v]) => `- ${k}: ${v.description}`)
    .join('\n');

  try {
    const raw = await complete({
      system: [
        `You are classifying whether a message from a business owner needs to RUN an agent, or just CONVERSE.`,
        `Available agents:`,
        agentList,
        ``,
        `If the message is asking to DO something (find leads, send emails, enrich, score, run pipeline, generate outreach), respond with JSON:`,
        `{"action":"dispatch","command":"<agent-name>","args":{"sector":"...","city":"...","limit":"20"}}`,
        `Only include args that are mentioned. "limit" defaults to "20" for scout.`,
        `If the message is a question, conversation, or status check, respond with:`,
        `{"action":"converse"}`,
        `Respond with ONLY valid JSON, nothing else.`,
      ].join('\n'),
      user: text,
      maxTokens: 150,
    });

    const parsed = JSON.parse(raw.trim());
    return parsed;
  } catch {
    return { action: 'converse' };
  }
}

// Detect action commands that need to actually change state
const ACTION_INTENTS = ['pause', 'resume'];

async function classifyActionIntent(text) {
  try {
    const raw = await complete({
      system: `Does this message ask to pause OR resume automated lead discovery? Reply with exactly one word: "pause", "resume", or "none".`,
      user: text,
      maxTokens: 10,
    });
    const intent = raw.trim().toLowerCase();
    return ACTION_INTENTS.includes(intent) ? intent : 'none';
  } catch {
    return 'none';
  }
}

async function buildContext(agencyId) {
  try {
    const [s, leads] = await Promise.all([
      getTelegramStatusSummary(agencyId),
      getQualifiedLeads(5, 6, agencyId),
    ]);
    const leadLines = leads.map(l => `- ${l.business_name} (score ${l.score}/10): ${l.score_reason ?? ''}`).join('\n');
    return [
      `TODAY'S METRICS:`,
      `Leads found today: ${s.leadsToday} | Total leads: ${s.leadsTotal} | Qualified: ${s.qualified}`,
      `Avg score: ${s.avgScore ?? 'N/A'} | Outreach drafts pending: ${s.drafts} | Sent today: ${s.sentToday}`,
      `Replies received: ${s.replied} | Proposals: ${s.proposals} | Overdue actions: ${s.dueOrOverdue}`,
      '',
      `TOP QUALIFIED LEADS:`,
      leadLines || 'None with score ≥ 6 right now.',
    ].join('\n');
  } catch {
    return 'Could not fetch live data right now.';
  }
}

async function conversationalReply(text, agencyId) {
  const context = await buildContext(agencyId);
  try {
    return await complete({
      system: [
        `You are the Tedmark Growth AI assistant — a sharp, helpful sales intelligence bot for the owner of Tedmark Digital, a digital marketing agency in Ghana.`,
        `You have access to live pipeline data shown below. Answer the owner's questions naturally and conversationally, like a knowledgeable colleague who has been watching the business all day.`,
        `Be concise but warm. Use plain text (no markdown — this is Telegram). If numbers are mentioned, be specific. If action is needed, say so clearly.`,
        `You can also handle: approving outreach, pausing/resuming discovery, explaining what the system is doing.`,
        ``,
        `LIVE DATA:`,
        context,
      ].join('\n'),
      user: text,
      maxTokens: 600,
    });
  } catch {
    return "I'm having trouble thinking right now — try again in a moment.";
  }
}

async function reply(link, chatId, text) {
  await sendMessage(chatId, text);
  await recordTelegramMessage(link.id, 'outbound', text);
}

async function handleCommand(link, text, chatId, agencyId) {
  const lower = text.toLowerCase();

  // Hard slash commands — instant, no AI needed
  if (lower === '/status') {
    const summary = await getTelegramStatusSummary(agencyId);
    await reply(link, chatId, formatStatus(summary));
    return;
  }
  if (lower === '/leads') {
    await reply(link, chatId, await formatTopLeads(agencyId));
    return;
  }
  if (lower === '/pause') {
    await setSetting('scout_enabled', false, agencyId);
    await setSetting('web_scout_enabled', false, agencyId);
    await setSetting('directory_scout_enabled', false, agencyId);
    await reply(link, chatId, 'Discovery paused. No new leads will be found until you say resume.');
    return;
  }
  if (lower === '/resume') {
    await setSetting('scout_enabled', true, agencyId);
    await setSetting('web_scout_enabled', true, agencyId);
    await setSetting('directory_scout_enabled', true, agencyId);
    await reply(link, chatId, 'Discovery resumed.');
    return;
  }
  if (lower === '/help') {
    await reply(link, chatId, HELP_TEXT);
    return;
  }

  // Natural language — check if it's a state-changing action first
  const action = await classifyActionIntent(text);
  if (action === 'pause') {
    await setSetting('scout_enabled', false, agencyId);
    await setSetting('web_scout_enabled', false, agencyId);
    await setSetting('directory_scout_enabled', false, agencyId);
    await reply(link, chatId, 'Done — discovery is paused. Just say "resume" when you want it back on.');
    return;
  }
  if (action === 'resume') {
    await setSetting('scout_enabled', true, agencyId);
    await setSetting('web_scout_enabled', true, agencyId);
    await setSetting('directory_scout_enabled', true, agencyId);
    await reply(link, chatId, 'Discovery is back on.');
    return;
  }

  // Classify: should we dispatch an agent or just converse?
  const dispatch = await classifyDispatch(text);

  if (dispatch.action === 'dispatch' && dispatch.command && AGENT_REGISTRY[dispatch.command]) {
    await sendMessage(chatId, `Got it — running ${dispatch.command}... this may take a minute.`);
    try {
      const result = await dispatchAgent(dispatch.command, dispatch.args ?? {});
      if (result.ok) {
        // Give AI a chance to summarise the output naturally
        const summary = await complete({
          system: `You are the Tedmark Growth AI assistant. Summarise the following agent output in plain, friendly language for the business owner. Be brief and highlight the key result. No markdown.`,
          user: `Agent "${dispatch.command}" completed.\n\nOutput:\n${result.output}`,
          maxTokens: 400,
        }).catch(() => result.output);
        await reply(link, chatId, summary);
      } else {
        await reply(link, chatId, `The ${dispatch.command} agent ran into an issue: ${result.output || 'unknown error'}`);
      }
    } catch (err) {
      await reply(link, chatId, `Failed to run ${dispatch.command}: ${err.message}`);
    }
    return;
  }

  // Pure conversation — full AI with live data context
  const response = await conversationalReply(text, agencyId);
  await reply(link, chatId, response);
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
