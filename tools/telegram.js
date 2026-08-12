// Thin wrapper around Telegram's Bot API — plain fetch, no SDK, matching
// how every other external API in this codebase is called (Geoapify,
// Brave, Jina Reader all skip an SDK too). Long-polling (getUpdates)
// rather than webhooks, since the dashboard has no public HTTPS URL yet —
// see scripts/telegramBot.js for the poller that uses this.
import dotenv from 'dotenv';

dotenv.config();

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing from .env — cannot use Telegram.');
  }
  return token;
}

function apiUrl(method) {
  return `https://api.telegram.org/bot${getBotToken()}/${method}`;
}

async function callApi(method, body) {
  const res = await fetch(apiUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${data.description ?? 'unknown error'}`);
  }
  return data.result;
}

/**
 * @param {number|string} chatId
 * @param {string} text
 * @param {{ buttons?: { text: string, callbackData: string }[][] }} [opts]
 */
export async function sendMessage(chatId, text, opts = {}) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };
  if (opts.buttons) {
    body.reply_markup = {
      inline_keyboard: opts.buttons.map((row) =>
        row.map((b) => ({ text: b.text, callback_data: b.callbackData }))
      ),
    };
  }
  return callApi('sendMessage', body);
}

export async function answerCallbackQuery(callbackQueryId, text) {
  return callApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: false });
}

export async function editMessageReplyMarkup(chatId, messageId) {
  // Removes the inline buttons after they've been acted on, so a stale
  // Approve/Reject pair can't be clicked twice.
  return callApi('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
}

export async function getUpdates(offset, timeoutSeconds = 30) {
  const res = await fetch(apiUrl('getUpdates'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offset, timeout: timeoutSeconds }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (getUpdates): ${data.description ?? 'unknown error'}`);
  }
  return data.result;
}

export async function setMyCommands(commands) {
  return callApi('setMyCommands', { commands });
}

export async function getMe() {
  return callApi('getMe', {});
}
