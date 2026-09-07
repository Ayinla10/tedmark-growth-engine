/**
 * DB-backed bot state store — survives server restarts.
 *
 * Each logical Map (pendingConfirmations, lastScoutResults, etc.) gets its
 * own key namespace prefix. Reads check an in-memory cache first; on a
 * cache miss (e.g. after restart) they fall back to the DB. Writes go to
 * both so subsequent reads stay fast.
 */

import { query } from './db.js';

// In-memory cache — populated lazily from DB on first miss
const cache = new Map();

async function get(key) {
  if (cache.has(key)) return cache.get(key);
  try {
    const res = await query(`SELECT value FROM bot_state WHERE key = $1`, [key]);
    const value = res.rows[0]?.value ?? null;
    if (value !== null) cache.set(key, value);
    return value;
  } catch (err) {
    console.warn(`[botState] get failed for "${key}": ${err.message}`);
    return null;
  }
}

async function set(key, value) {
  cache.set(key, value);
  try {
    await query(
      `INSERT INTO bot_state (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
  } catch (err) {
    console.warn(`[botState] set failed for "${key}": ${err.message}`);
  }
}

async function del(key) {
  cache.delete(key);
  try {
    await query(`DELETE FROM bot_state WHERE key = $1`, [key]);
  } catch (err) {
    console.warn(`[botState] delete failed for "${key}": ${err.message}`);
  }
}

// ── Namespaced helpers ─────────────────────────────────────────────────────────

export const pendingConfirmations = {
  get: (chatId)         => get(`tg_pending:${chatId}`),
  set: (chatId, value)  => set(`tg_pending:${chatId}`, value),
  del: (chatId)         => del(`tg_pending:${chatId}`),
};

export const pendingArgCollection = {
  get: (chatId)         => get(`tg_args:${chatId}`),
  set: (chatId, value)  => set(`tg_args:${chatId}`, value),
  del: (chatId)         => del(`tg_args:${chatId}`),
};

export const lastScoutResults = {
  get: (chatId)         => get(`tg_scout:${chatId}`),
  set: (chatId, value)  => set(`tg_scout:${chatId}`, value),
  del: (chatId)         => del(`tg_scout:${chatId}`),
};

export const waPending = {
  get: (phone)          => get(`wa_pending:${phone}`),
  set: (phone, value)   => set(`wa_pending:${phone}`, value),
  del: (phone)          => del(`wa_pending:${phone}`),
};
