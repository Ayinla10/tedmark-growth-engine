import pool from "./db";

// Mirrors tools/agency.js on the backend. Stage 1 of the multi-tenant
// architecture has no per-request auth->agency mapping yet (that's Stage
// 2 — tying a logged-in user to their agency) — every dashboard page
// resolves "the current agency" as the one agency this deployment runs
// for, same as the backend CLI does.
let cachedAgencyId: string | null = null;

export async function getCurrentAgencyId(): Promise<string> {
  if (cachedAgencyId) return cachedAgencyId;

  if (process.env.AGENCY_ID) {
    cachedAgencyId = process.env.AGENCY_ID;
    return cachedAgencyId;
  }

  const result = await pool.query("SELECT id FROM agencies ORDER BY created_at LIMIT 1");
  if (result.rows.length === 0) {
    throw new Error("No agency exists yet — run db/schema.sql to seed the default agency.");
  }
  if (result.rows.length > 1) {
    throw new Error("Multiple agencies exist — set AGENCY_ID in web/.env.local to disambiguate.");
  }

  const resolved: string = result.rows[0].id;
  cachedAgencyId = resolved;
  return resolved;
}
