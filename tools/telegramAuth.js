// Short-lived callback tokens for Telegram inline buttons.
//
// Telegram caps callback_data at 64 bytes, which rules out a
// self-contained signed JSON payload — so instead the button carries only
// a short random token, and the real action/target/expiry live in
// telegram_callback_tokens. This also gives "already used" and "current
// state" checks for free (spec section 43: an old button must not
// execute a stale action), which a stateless signed token wouldn't.
import crypto from 'crypto';
import { query } from './db.js';

const DEFAULT_TTL_SECONDS = 60 * 60 * 48; // 48 hours

export async function createCallbackToken(telegramLinkId, action, targetId, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const token = crypto.randomBytes(9).toString('base64url'); // 12 chars, well under the 64-byte cap
  await query(
    `INSERT INTO telegram_callback_tokens (token, telegram_link_id, action, target_id, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval)`,
    [token, telegramLinkId, action, targetId ?? null, ttlSeconds]
  );
  return token;
}

/**
 * Verifies a token is real, unexpired, unused, and belongs to the chat
 * that's clicking it — then marks it used atomically (a single UPDATE ...
 * WHERE used_at IS NULL, so a double-click race can't execute twice).
 * Returns the { action, target_id } payload, or null if invalid.
 */
export async function consumeCallbackToken(token, telegramLinkId) {
  const result = await query(
    `UPDATE telegram_callback_tokens
     SET used_at = now()
     WHERE token = $1 AND telegram_link_id = $2 AND used_at IS NULL AND expires_at > now()
     RETURNING action, target_id`,
    [token, telegramLinkId]
  );
  return result.rows[0] ?? null;
}
