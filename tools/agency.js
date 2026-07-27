import { query } from './db.js';

// Stage 1 of the multi-tenant architecture: there is no per-request auth
// context yet (that's Stage 2), so every CLI/agent call resolves "the
// current agency" the same way — the one agency this process is running
// for. AGENCY_ID in .env pins it explicitly; falling back to "the only
// row in the table" keeps every existing single-tenant call site working
// unchanged as long as there's exactly one agency (true for Tedmark today).
let cachedAgencyId = null;

export async function getCurrentAgencyId() {
  if (cachedAgencyId) return cachedAgencyId;

  if (process.env.AGENCY_ID) {
    cachedAgencyId = process.env.AGENCY_ID;
    return cachedAgencyId;
  }

  const result = await query('SELECT id FROM agencies ORDER BY created_at LIMIT 1');
  if (result.rows.length === 0) {
    throw new Error('No agency exists yet — run db/schema.sql to seed the default agency.');
  }
  if (result.rows.length > 1) {
    throw new Error('Multiple agencies exist — set AGENCY_ID in .env to disambiguate which one this process runs for.');
  }

  cachedAgencyId = result.rows[0].id;
  return cachedAgencyId;
}

// Exposed for tests only — resets the module-level cache between runs.
export function _resetAgencyCache() {
  cachedAgencyId = null;
}
