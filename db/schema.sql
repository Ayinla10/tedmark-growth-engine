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
  qualified_at timestamptz,
  source text NOT NULL DEFAULT 'maps' CHECK (source IN ('maps', 'web', 'linkedin', 'facebook')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Safe to re-run against an existing database — adds columns if this
-- schema was applied before they existed.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enriched_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'maps';

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
  knowledge_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outreach ADD COLUMN IF NOT EXISTS knowledge_ids uuid[] NOT NULL DEFAULT '{}';

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
  knowledge_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS knowledge_ids uuid[] NOT NULL DEFAULT '{}';

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

-- Same rotation idea as scout_progress, but for Search-API-based discovery
-- (general web + LinkedIn + Facebook query variants) — each sector/city/
-- query-type combination pages forward independently across daily runs.
CREATE TABLE IF NOT EXISTS search_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector text NOT NULL,
  city text NOT NULL,
  query_type text NOT NULL CHECK (query_type IN ('web', 'linkedin', 'facebook')),
  next_start integer NOT NULL DEFAULT 1,
  exhausted boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector, city, query_type)
);

-- Configurable agent behavior, editable from the dashboard Settings page
-- instead of being hardcoded in source files.
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The shared "brain" agents draw on when writing/scoring — company facts,
-- pricing, sales playbook, case studies, etc. Only published + approved
-- items are actually injected into agent prompts.
CREATE TABLE IF NOT EXISTS knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  applicable_agents text[] NOT NULL DEFAULT '{}',
  target_audience text,
  tags text[] NOT NULL DEFAULT '{}',
  source text,
  approved boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_agents ON knowledge_items USING gin (applicable_agents);

-- Snapshots produced by the Analytics agent: real aggregate stats computed
-- from the pipeline data (not a presentation-only placeholder), plus a
-- plain-English summary the dashboard can show directly.
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  insights jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dashboard users. There is no public signup — accounts are created via
-- the create-admin CLI script (web/scripts/create-user.mjs).
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_outreach_lead_id ON outreach(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead_id ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_replies_lead_id ON replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_scout_progress_rotation ON scout_progress(exhausted, last_run_at);
