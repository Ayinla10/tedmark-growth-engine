/**
 * Migration: add pipeline orchestration columns to leads table.
 * Run once: node scripts/migrate-pipeline-columns.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS enrichment_attempts   int         NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_enriched_at      timestamptz,
    ADD COLUMN IF NOT EXISTS pipeline_paused       bool        NOT NULL DEFAULT false;
`);

console.log('Migration complete.');
await client.end();
