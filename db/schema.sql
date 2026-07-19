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
  source text NOT NULL DEFAULT 'maps' CHECK (source IN ('maps', 'web', 'linkedin', 'facebook', 'directory')),
  site_signals jsonb,
  recommended_service text,
  social_url text,
  discovery_evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Safe to re-run against an existing database — adds columns if this
-- schema was applied before they existed.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enriched_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'maps';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_signals jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS recommended_service text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS social_url text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discovery_evidence jsonb;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('maps', 'web', 'linkedin', 'facebook', 'directory'));

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

-- Replies — either pasted in manually, or picked up automatically by the
-- IMAP reply watcher polling contact@tedmarkdigital.com. Automatic replies
-- get an AI classification and (usually) an auto-drafted next outreach
-- message, both left for human approval before anything sends.
CREATE TABLE IF NOT EXISTS replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  outreach_id uuid REFERENCES outreach(id),
  body text NOT NULL,
  from_email text,
  message_id text UNIQUE,
  classification text CHECK (classification IN ('interested', 'not_interested', 'needs_info', 'out_of_office', 'unsubscribe', 'other')),
  draft_outreach_id uuid REFERENCES outreach(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE replies ADD COLUMN IF NOT EXISTS from_email text;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS message_id text;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS classification text;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS draft_outreach_id uuid REFERENCES outreach(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_replies_message_id ON replies(message_id) WHERE message_id IS NOT NULL;

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
  next_offset integer NOT NULL DEFAULT 0,
  exhausted boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector, city, query_type)
);

-- Rotation checkpoint for the free BusinessGhana.com directory scrape (see
-- tools/directoryClient.js). No city dimension here — the directory isn't
-- filterable by location via URL, only by category — so this is keyed on
-- the category slug itself, with `sector` kept alongside purely for
-- grouping/reporting which of our sectors a slug belongs to.
CREATE TABLE IF NOT EXISTS directory_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug text NOT NULL UNIQUE,
  sector text NOT NULL,
  next_page integer NOT NULL DEFAULT 1,
  exhausted boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Logs one row per real Search API call, so real monthly usage can be
-- shown against the provider's free-tier quota instead of guessing.
CREATE TABLE IF NOT EXISTS search_api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_api_usage_used_at ON search_api_usage(used_at);

-- Configurable agent behavior, editable from the dashboard Settings page
-- instead of being hardcoded in source files.
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reusable sign-offs for outreach emails/WhatsApp messages — was previously
-- hardcoded into the outreach prompts. Whichever one is_default gets used
-- when a batch is generated without an explicit choice.
CREATE TABLE IF NOT EXISTS signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
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
