import { sendMessage } from './telegram.js';
import { getActiveTelegramLinksForAgency, recordTelegramMessage } from './db.js';
import { createCallbackToken } from './telegramAuth.js';

const LEVELS = ['LOW', 'INFO', 'IMPORTANT', 'ACTION_REQUIRED', 'CRITICAL'];

// ACTION_REQUIRED and CRITICAL always reach the human regardless of their
// configured minimum — an approval request or a system-wide failure must
// never be silently suppressed by a notification preference.
const ALWAYS_SEND = new Set(['ACTION_REQUIRED', 'CRITICAL']);

/**
 * Sends a message to every Telegram account linked to an agency, honoring
 * each link's own minimum notification level. Never throws — a missing
 * bot token or an unlinked agency just means no notification goes out,
 * which should never break the agent that triggered it.
 * @param {string} agencyId
 * @param {'LOW'|'INFO'|'IMPORTANT'|'ACTION_REQUIRED'|'CRITICAL'} level
 * @param {string} text
 * @param {{ buttons?: { text: string, callbackData: string }[][] }} [opts]
 */
export async function notifyTelegram(agencyId, level, text, opts = {}) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  let links;
  try {
    links = await getActiveTelegramLinksForAgency(agencyId);
  } catch (err) {
    console.warn(`[telegram-notify] Could not load links: ${err.message}`);
    return;
  }

  const levelIndex = LEVELS.indexOf(level);

  for (const link of links) {
    if (!ALWAYS_SEND.has(level) && levelIndex < LEVELS.indexOf(link.min_notification_level)) {
      continue;
    }
    try {
      await sendMessage(link.telegram_chat_id, text, opts);
      await recordTelegramMessage(link.id, 'outbound', text, { level });
    } catch (err) {
      console.warn(`[telegram-notify] Failed to notify chat ${link.telegram_chat_id}: ${err.message}`);
    }
  }
}

/**
 * Sends an approval request with real APPROVE/REJECT buttons to every
 * linked account for the agency — a fresh callback token per recipient,
 * since a token is scoped to one telegram_link (never shared/guessable
 * across chats). Always ACTION_REQUIRED, so it's never silently
 * suppressed by a notification-level preference.
 */
/**
 * Sends an approval request split across two messages:
 *   1. Lead card (Markdown formatted) — always safe, no user-generated content
 *   2. Draft body (plain text) + Approve/Edit/Reject buttons
 *
 * Splitting prevents a broken character in the LLM draft from killing the
 * lead card (Telegram rejects the entire message on any Markdown parse error).
 */
export async function notifyTelegramApproval(agencyId, cardText, draftText, action, targetId) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  let links;
  try {
    links = await getActiveTelegramLinksForAgency(agencyId);
  } catch (err) {
    console.warn(`[telegram-notify] Could not load links: ${err.message}`);
    return;
  }

  for (const link of links) {
    try {
      // Message 1: lead card with Markdown formatting
      await sendMessage(link.telegram_chat_id, cardText, {});

      // Message 2: draft body (plain text) + action buttons
      const approveToken = await createCallbackToken(link.id, `approve_${action}`, targetId);
      const rejectToken  = await createCallbackToken(link.id, `reject_${action}`, targetId);
      const editToken    = await createCallbackToken(link.id, `edit_${action}`, targetId);
      await sendMessage(link.telegram_chat_id, draftText, {
        plain: true,
        buttons: [[
          { text: '✅ Approve', callbackData: approveToken },
          { text: '✏️ Edit',   callbackData: editToken },
          { text: '❌ Reject', callbackData: rejectToken },
        ]],
      });

      await recordTelegramMessage(link.id, 'outbound', cardText + '\n\n' + draftText, { level: 'ACTION_REQUIRED', action, targetId });
    } catch (err) {
      console.warn(`[telegram-notify] Failed to send approval to chat ${link.telegram_chat_id}: ${err.message}`);
    }
  }
}
