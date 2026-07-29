#!/usr/bin/env node
// Creates or updates a dashboard user. There is no public signup UI —
// this is the only way to provision an account.
//
// Usage: node scripts/create-user.mjs <email> <password> <name> [role] [agencyName]
//
// role defaults to "admin" (belongs to exactly one agency). "super_admin"
// belongs to no single agency (Stage 2) — omit agencyName for that role.
// For every other role, agencyName picks which agency by name; if
// omitted and exactly one agency exists, that one is used automatically.

import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

const [, , email, password, name, role = "admin", agencyName] = process.argv;

if (!email || !password || !name) {
  console.error("Usage: node scripts/create-user.mjs <email> <password> <name> [role] [agencyName]");
  process.exit(1);
}

const cleanUrl = (process.env.DATABASE_URL ?? "").replace(/[?&](sslmode|channel_binding)=[^&]*/g, "");
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });

async function resolveAgencyId() {
  if (role === "super_admin") return null;

  if (agencyName) {
    const res = await pool.query("SELECT id FROM agencies WHERE name = $1", [agencyName]);
    if (res.rows.length === 0) {
      throw new Error(`No agency found named "${agencyName}".`);
    }
    return res.rows[0].id;
  }

  const res = await pool.query("SELECT id FROM agencies ORDER BY created_at LIMIT 2");
  if (res.rows.length === 0) {
    throw new Error("No agency exists yet — run db/schema.sql to seed the default agency.");
  }
  if (res.rows.length > 1) {
    throw new Error("Multiple agencies exist — pass agencyName explicitly.");
  }
  return res.rows[0].id;
}

async function main() {
  const agencyId = await resolveAgencyId();
  const passwordHash = await bcrypt.hash(password, 12);
  const res = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, agency_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3, role = $4, agency_id = $5
     RETURNING id, email, name, role, agency_id`,
    [email.toLowerCase().trim(), passwordHash, name, role, agencyId]
  );
  console.log("User ready:", res.rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
