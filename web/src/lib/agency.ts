import pool from "./db";
import { getSession } from "./auth";

// Mirrors tools/agency.js on the backend, but Stage 2 adds real
// per-request resolution here (the backend CLI has no such thing — it's
// not a request, it just runs for whichever agency AGENCY_ID/the single
// row resolves to).
//
// IMPORTANT: unlike tools/agency.js, this can NOT cache the resolved id
// at module scope — a Next.js server process is shared across requests
// from different logged-in users, so caching here would leak one
// request's agency onto another's. Only the env-var/single-agency
// fallback paths (which are process-wide facts, not per-user ones) are
// safe to treat as stable within a process.
let cachedFallbackAgencyId: string | null = null;

async function resolveFallbackAgencyId(): Promise<string> {
  if (cachedFallbackAgencyId) return cachedFallbackAgencyId;

  if (process.env.AGENCY_ID) {
    cachedFallbackAgencyId = process.env.AGENCY_ID;
    return cachedFallbackAgencyId;
  }

  const result = await pool.query("SELECT id FROM agencies ORDER BY created_at LIMIT 1");
  if (result.rows.length === 0) {
    throw new Error("No agency exists yet — run db/schema.sql to seed the default agency.");
  }
  if (result.rows.length > 1) {
    throw new Error("Multiple agencies exist and no logged-in session or AGENCY_ID resolved one — cannot pick automatically.");
  }

  const resolved: string = result.rows[0].id;
  cachedFallbackAgencyId = resolved;
  return resolved;
}

export async function getCurrentAgencyId(): Promise<string> {
  // Real per-request resolution: the logged-in user's own agency, from
  // their session — this is what actually makes Stage 2 "auth-scoped"
  // rather than just single-tenant-by-assumption.
  const session = await getSession().catch(() => null);
  if (session?.agencyId) return session.agencyId;

  if (session && session.role === "super_admin") {
    throw new Error(
      "Logged in as super_admin with no agency selected — impersonating a specific agency isn't built yet (Stage 4)."
    );
  }

  // No session at all — a script or context outside a request (cookies()
  // throws there), or genuinely running for a single agency deployment.
  return resolveFallbackAgencyId();
}
