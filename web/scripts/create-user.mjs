#!/usr/bin/env node
// Creates or updates a dashboard user. There is no public signup UI —
// this is the only way to provision an account.
//
// Usage: node scripts/create-user.mjs <email> <password> <name> [role]

import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

const [, , email, password, name, role = "admin"] = process.argv;

if (!email || !password || !name) {
  console.error("Usage: node scripts/create-user.mjs <email> <password> <name> [role]");
  process.exit(1);
}

const cleanUrl = (process.env.DATABASE_URL ?? "").replace(/[?&](sslmode|channel_binding)=[^&]*/g, "");
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const res = await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3, role = $4
     RETURNING id, email, name, role`,
    [email.toLowerCase().trim(), passwordHash, name, role]
  );
  console.log("User ready:", res.rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
