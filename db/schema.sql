-- TEDMARK AI GROWTH ENGINE — database schema
-- Run with: psql $DATABASE_URL -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  sector text,
  location text,
  website_url text,
  phone text,
  email text,
  score integer,
  score_reason text,
  status text NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'qualified', 'contacted', 'archived')),
  enriched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Safe to re-run against an existing database — adds the column if this
-- schema was applied before enriched_at existed.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

CREATE TABLE IF NOT EXISTS outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  message_type text NOT NULL CHECK (message_type IN ('email', 'whatsapp')),
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
  sent_at timestamptz,
  opened boolean NOT NULL DEFAULT false,
  replied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  sequence_step integer NOT NULL CHECK (sequence_step IN (1, 2, 3)),
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped'))
);

CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  services text[],
  budget_range text,
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Manually-logged replies (no inbound email/WhatsApp webhook is wired up —
-- this is a human pasting in what a lead wrote back, so it can render as a
-- chat thread instead of only the outreach.replied boolean).
CREATE TABLE IF NOT EXISTS replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  outreach_id uuid REFERENCES outreach(id),
  body text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tracks how far Scout has paged into Geoapify's results for each
-- sector+city combination, so daily runs advance to fresh results instead
-- of re-fetching the same top-N businesses forever.
CREATE TABLE IF NOT EXISTS scout_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector text NOT NULL,
  city text NOT NULL,
  next_offset integer NOT NULL DEFAULT 0,
  exhausted boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector, city)
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_outreach_lead_id ON outreach(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead_id ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_replies_lead_id ON replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_scout_progress_rotation ON scout_progress(exhausted, last_run_at);
