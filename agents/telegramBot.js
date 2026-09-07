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
  getOverdueLeads,
  getOutreachWithoutReply,
  getOverdueWithValue,
  query,
} from '../tools/db.js';
import { runApprove, runSend } from './outreach.js';
import { setSetting } from '../tools/settings.js';
import { notifyTelegram } from '../tools/telegramNotify.js';
import { processOwnerMessage, dispatchAgent, summariseAgentResult, loadBusinessContext, compressConversationSummary, updateOwnerPreferences } from './conversationEngine.js';
import { pendingConfirmations, pendingArgCollection, lastScoutResults, conversationSummary, planQueue, ownerPreferences, declinedSuggestions } from '../tools/botState.js';

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

// pendingConfirmations, pendingArgCollection, lastScoutResults are imported
// from tools/botState.js — DB-backed, survive server restarts.

// ── Inline keyboards for each agent argument ───────────────────────────────────
const ARG_KEYBOARDS = {
  sector: [
    [
      { label: 'Clinics',       value: 'clinic' },
      { label: 'Restaurants',   value: 'restaurant' },
      { label: 'Pharmacies',    value: 'pharmacy' },
    ],
    [
      { label: 'Hotels',        value: 'hotel' },
      { label: 'Schools',       value: 'school' },
      { label: 'Salons',        value: 'salon' },
    ],
    [
      { label: 'Retail Shops',  value: 'retail' },
      { label: 'Real Estate',   value: 'real estate' },
      { label: 'Logistics',     value: 'logistics' },
    ],
    [
      { label: 'Gyms',          value: 'gym' },
      { label: 'Banks',         value: 'bank' },
      { label: 'Supermarkets',  value: 'supermarket' },
    ],
  ],
  city: [
    [
      { label: 'Accra',       value: 'Accra' },
      { label: 'Kumasi',      value: 'Kumasi' },
      { label: 'Takoradi',    value: 'Takoradi' },
    ],
    [
      { label: 'Tamale',      value: 'Tamale' },
      { label: 'Cape Coast',  value: 'Cape Coast' },
      { label: 'Tema',        value: 'Tema' },
    ],
    [
      { label: 'Sunyani',     value: 'Sunyani' },
      { label: 'Ho',          value: 'Ho' },
      { label: 'Koforidua',   value: 'Koforidua' },
    ],
  ],
  limit: [
    [
      { label: '5',   value: '5' },
      { label: '10',  value: '10' },
      { label: '20',  value: '20' },
      { label: '50',  value: '50' },
    ],
  ],
};

function buildArgButtons(command, asking) {
  const rows = ARG_KEYBOARDS[asking];
  if (!rows) return null;
  return rows.map(row =>
    row.map(btn => ({
      text: btn.label,
      callbackData: `arg:${command}:${asking}:${btn.value}`,
    }))
  );
}

async function sendArgKeyboard(chatId, command, args, asking) {
  const buttons = buildArgButtons(command, asking);
  const questions = {
    sector: '🏢 What type of businesses are you targeting?',
    city:   '📍 Which city in Ghana?',
    limit:  '🔢 How many leads do you want?',
  };
  const question = questions[asking] ?? `What is the ${asking}?`;
  await pendingArgCollection.set(chatId, { command, args, asking });
  if (buttons) {
    await sendMessage(chatId, question, { buttons });
  } else {
    await sendMessage(chatId, question);
  }
}

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

    // ── Feature 2: pending plan — let AI decide confirmed/cancelled/clarify ──────
    const pendingPlan = await planQueue.get(chatId);

    // ── Intelligent conversation engine ────────────────────────────────────────
    const [pending, summaryRaw] = await Promise.all([
      pendingConfirmations.get(chatId),
      conversationSummary.get(chatId),
    ]);

    // Build last-scout context string for the AI prompt — persists until a new scout replaces it
    const scoutMem = await lastScoutResults.get(chatId);
    let lastScoutContext = '';
    if (scoutMem) {
      const when = new Date(scoutMem.at).toLocaleDateString('en-GH', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      lastScoutContext = `LAST SCOUT (${when}): Found ${scoutMem.count} ${scoutMem.sector ?? ''} leads in ${scoutMem.city ?? 'Ghana'}.\nLead IDs (use these when owner says "those", "them", "the ones we found", "enrich those", "qualify them", etc.): ${scoutMem.lead_ids.join(',')}`;
    }

    // Auto-inject lead_ids for clearly referential messages ("enrich those", "qualify them")
    const isReferential = /\b(those|them|these|the ones|the leads?|what you found|just found)\b/i.test(text);

    // Build the effective pending confirmation — prefer a pending plan over a single-step pending
    const effectivePending = pendingPlan
      ? { command: 'plan', args: {}, _plan: pendingPlan }
      : (pending ?? null);

    const result = await processOwnerMessage({
      text,
      linkId: link.id,
      agencyId,
      pendingConfirmation: effectivePending,
      lastScoutContext,
      conversationSummaryText: summaryRaw ?? '',
    });

    // If AI dispatched an agent without lead_ids but owner was clearly referencing the last scout
    if (isReferential && scoutMem && result.dispatch && !result.dispatch.args?.lead_ids) {
      result.dispatch.args = { ...result.dispatch.args, lead_ids: scoutMem.lead_ids.join(',') };
    }

    // Handle plan confirmed/cancelled
    if (pendingPlan && result.clearPending) {
      await planQueue.del(chatId);
      if (result.dispatch?.command === 'plan') {
        // AI confirmed — execute the plan steps
        stopTyping();
        await reply(link, chatId, 'Got it — executing the plan.');
        await executePlanSteps(pendingPlan, link, chatId, agencyId);
        return;
      }
      // AI cancelled — track as declined
      const declined = pendingPlan.steps?.map(s => s.command) ?? [];
      if (declined.length) await declinedSuggestions.add(link.id, declined);
    }

    // Update pending state
    if (result.clearPending || result.dispatch) await pendingConfirmations.del(chatId);
    if (result.setPending) await pendingConfirmations.set(chatId, result.setPending);
    if (result.setPlan) await planQueue.set(chatId, result.setPlan);

    // Track declined commands so the bot stops re-suggesting them
    if (result.clearPending && !result.dispatch && pending?.command) {
      await declinedSuggestions.add(link.id, pending.command);
    }
    // If AI dispatched a previously-declined command (owner explicitly asked), clear it from declined list
    if (result.dispatch?.command) {
      await declinedSuggestions.remove(link.id, result.dispatch.command);
    }

    stopTyping();

    // If a required arg is missing, show a selection keyboard instead of plain text
    if (result.argKeyboard) {
      const { command, args, asking } = result.argKeyboard;
      await sendArgKeyboard(chatId, command, args, asking);
      return;
    }

    await reply(link, chatId, result.reply);

    // Pillar 2: update rolling conversation summary (non-blocking)
    compressConversationSummary(summaryRaw ?? '', text, result.reply)
      .then(newSummary => conversationSummary.set(chatId, newSummary))
      .catch(() => {});

    // Feature 5: learn from corrections (non-blocking)
    const isCorrection = /\b(no,|not that|wrong|that's not|don't do that|i said|i meant|actually|instead)\b/i.test(text);
    if (isCorrection) {
      ownerPreferences.get(agencyId)
        .then(existing => updateOwnerPreferences(agencyId, existing ?? '', text, result.reply, true))
        .then(updated => ownerPreferences.set(agencyId, updated))
        .catch(() => {});
    }

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

        // Store scout results so follow-up commands can reference "those leads"
        if (['scout', 'web-scout'].includes(command) && agentResult.lead_ids?.length) {
          const names = (agentResult.output ?? '').match(/- (.+?) \(/g)?.map(s => s.slice(2, -2)) ?? [];
          await lastScoutResults.set(chatId, {
            lead_ids: agentResult.lead_ids,
            names,
            sector: args.sector,
            city: args.city,
            count: agentResult.lead_ids.length,
            at: new Date().toISOString(),
          });
        }

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

  // ── Arg selection keyboard callback ──────────────────────────────────────────
  if (cb.data?.startsWith('arg:')) {
    const [, command, argName, ...valueParts] = cb.data.split(':');
    const value = valueParts.join(':'); // handles values with colons
    const state = await pendingArgCollection.get(chatId);
    const collectedArgs = state?.command === command ? { ...state.args } : {};
    collectedArgs[argName] = value;
    await pendingArgCollection.del(chatId);
    await editMessageReplyMarkup(chatId, cb.message.message_id);
    await answerCallbackQuery(cb.id, `✓ ${value}`);

    // Check if more required args are still missing
    const { AGENT_REGISTRY } = await import('./conversationEngine.js');
    const agent = AGENT_REGISTRY[command];
    const nextMissing = (agent?.requiredArgs ?? []).find(k => !collectedArgs[k]);
    if (nextMissing) {
      await sendArgKeyboard(chatId, command, collectedArgs, nextMissing);
      return;
    }

    // All args collected — send a confirm message with a run button
    const label = Object.entries(collectedArgs)
      .filter(([k]) => k !== 'limit')
      .map(([, v]) => v)
      .join(' in ');
    const confirmMsg = `Run *${command}* for *${label}*?`;
    await pendingConfirmations.set(chatId, { command, args: { ...agent?.defaults, ...collectedArgs } });
    await sendMessage(chatId, confirmMsg, {
      buttons: [[
        { text: '✅ Yes, run it', callbackData: `confirm:${command}:yes` },
        { text: '❌ Cancel',     callbackData: `confirm:${command}:no` },
      ]],
    });
    return;
  }

  // ── Run/cancel confirmation button ───────────────────────────────────────────
  if (cb.data?.startsWith('confirm:')) {
    const [, command, answer] = cb.data.split(':');
    await editMessageReplyMarkup(chatId, cb.message.message_id);
    if (answer === 'no') {
      const cancelledPending = await pendingConfirmations.get(chatId);
      await pendingConfirmations.del(chatId);
      // Track this as a declined suggestion
      if (cancelledPending?.command) {
        await declinedSuggestions.add(link.id, cancelledPending.command);
      }
      await answerCallbackQuery(cb.id, 'Cancelled');
      await sendMessage(chatId, 'Cancelled. What else?');
      return;
    }
    // yes — dispatch
    const pending = await pendingConfirmations.get(chatId);
    if (!pending || pending.command !== command) {
      await answerCallbackQuery(cb.id, 'Session expired, please try again.');
      return;
    }
    await pendingConfirmations.del(chatId);
    await answerCallbackQuery(cb.id, 'Running...');
    await sendMessage(chatId, `On it — running *${command}*... this may take a minute.`);
    const stopAgentTyping = startTyping(chatId);
    try {
      const agentResult = await dispatchAgent(pending.command, pending.args);
      const bizCtx = await loadBusinessContext(link.agency_id).catch(() => '');
      stopAgentTyping();

      // Store scout results for follow-up
      if (['scout', 'web-scout'].includes(pending.command) && agentResult.lead_ids?.length) {
        const names = (agentResult.output ?? '').match(/- (.+?) \(/g)?.map(s => s.slice(2, -2)) ?? [];
        await lastScoutResults.set(chatId, {
          lead_ids: agentResult.lead_ids,
          names,
          sector: pending.args.sector,
          city: pending.args.city,
          count: agentResult.lead_ids.length,
          at: new Date().toISOString(),
        });
      }

      if (agentResult.ok) {
        const summary = await summariseAgentResult(pending.command, agentResult.output, bizCtx);
        await sendMessage(chatId, summary);
        await recordTelegramMessage(link.id, 'outbound', summary);
      } else {
        await sendMessage(chatId, `The ${pending.command} agent ran into a problem: ${agentResult.output || 'unknown error'}`);
      }
    } catch (err) {
      stopAgentTyping();
      await sendMessage(chatId, `Couldn't reach the ${pending.command} agent: ${err.message}`);
    }
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

// ── Feature 2: execute an agent chain step by step ────────────────────────────
async function executePlanSteps(plan, link, chatId, agencyId) {
  const bizCtx = await loadBusinessContext(agencyId).catch(() => '');
  for (let i = plan.currentIndex; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const stepLabel = step.label ?? step.command;
    const isLast = i === plan.steps.length - 1;
    await sendMessage(chatId, `Step ${i + 1}/${plan.steps.length}: Running *${stepLabel}*...`);
    await recordTelegramMessage(link.id, 'outbound', `Step ${i + 1}: Running ${stepLabel}`);
    const stopTyping = startTyping(chatId);
    try {
      const agentResult = await dispatchAgent(step.command, step.args ?? {});
      stopTyping();
      // Persist scout results for follow-up referencing
      if (['scout', 'web-scout'].includes(step.command) && agentResult.lead_ids?.length) {
        const names = (agentResult.output ?? '').match(/- (.+?) \(/g)?.map(s => s.slice(2, -2)) ?? [];
        await lastScoutResults.set(chatId, {
          lead_ids: agentResult.lead_ids,
          names,
          sector: step.args?.sector,
          city: step.args?.city,
          count: agentResult.lead_ids.length,
          at: new Date().toISOString(),
        });
        // Inject lead_ids into remaining steps that don't specify them
        for (let j = i + 1; j < plan.steps.length; j++) {
          if (!plan.steps[j].args?.lead_ids) {
            plan.steps[j].args = { ...plan.steps[j].args, lead_ids: agentResult.lead_ids.join(',') };
          }
        }
      }
      const summary = agentResult.ok
        ? await summariseAgentResult(step.command, agentResult.output, bizCtx)
        : `The ${step.command} step ran into a problem: ${agentResult.output || 'unknown error'}`;
      const suffix = isLast ? '\n\nAll steps complete.' : '';
      await reply(link, chatId, summary + suffix);
    } catch (err) {
      stopTyping();
      await reply(link, chatId, `I couldn't reach the ${step.command} agent: ${err.message}. Plan paused.`);
      await planQueue.del(chatId);
      return;
    }
  }
  await planQueue.del(chatId);
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

  // Pillar 3 / Feature 7: proactive overdue alerts with deal value — 09:00 Ghana time
  cron.schedule('0 9 * * *', async () => {
    console.log('[telegram-bot] Proactive overdue check running...');
    try {
      const agencyIds = await getAgencyIdsWithActiveTelegramLinks();
      for (const { agency_id, chat_id } of agencyIds) {
        const { rows, totalValue, currency } = await getOverdueWithValue(agency_id, 5);
        if (!rows.length) continue;
        const lines = rows.map(l => {
          const val = l.deal_value ? ` (${l.deal_currency ?? currency}${Number(l.deal_value).toLocaleString()})` : '';
          return `• *${l.business_name}*${val} — ${l.next_action ?? 'action'} overdue ${l.days_overdue}d`;
        }).join('\n');
        const valueMsg = totalValue > 0
          ? `\n\n*${currency}${totalValue.toLocaleString()} in pipeline value* is sitting overdue.`
          : '';
        await sendMessage(
          chat_id,
          `⚠️ *${rows.length} lead${rows.length > 1 ? 's' : ''} need attention today:*\n\n${lines}${valueMsg}\n\nWant me to prioritize by value, or tell me which one to focus on first?`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      console.error('[telegram-bot] Proactive overdue check failed:', err.message);
    }
  });

  // Feature 4: proactive outreach follow-up — 10:00 AM, check for sent emails with no reply after 3 days
  cron.schedule('0 10 * * *', async () => {
    console.log('[telegram-bot] Proactive outreach follow-up check running...');
    try {
      const agencyIds = await getAgencyIdsWithActiveTelegramLinks();
      for (const { agency_id, chat_id } of agencyIds) {
        const waiting = await getOutreachWithoutReply(agency_id, 3, 8);
        if (!waiting.length) continue;
        const lines = waiting.map(o => {
          const daysSince = Math.floor((Date.now() - new Date(o.sent_at).getTime()) / 86400000);
          return `• *${o.business_name}* — "${o.subject ?? 'outreach'}" sent ${daysSince}d ago, no reply yet`;
        }).join('\n');
        await sendMessage(
          chat_id,
          `📬 *${waiting.length} email${waiting.length > 1 ? 's' : ''} still waiting for a reply:*\n\n${lines}\n\nWant me to check replies now, or draft a follow-up for any of these?`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      console.error('[telegram-bot] Proactive follow-up check failed:', err.message);
    }
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
