-- TEDMARK AI GROWTH ENGINE — database schema
-- Run with: psql $DATABASE_URL -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Stage 1 of the multi-tenant SaaS architecture: one row per agency using
-- the platform. Tedmark itself is agency #1 — nothing changes about how
-- Tedmark's own data behaves, this just gives every table a tenant
-- boundary to hang off going forward. Per-agency API credentials
-- (Geoapify/Brave/DeepSeek/Resend/IMAP keys) live in `credentials` rather
-- than on this table directly, so a credential rotation never requires a
-- schema change.
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_email text,
  plan_tier text NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'paid')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Per-agency credentials, kept out of `agencies` itself and out of a
-- shared `.env` so each agency's Geoapify/Brave/DeepSeek/Resend/IMAP keys
-- are isolated. `provider` is a free-form key (e.g. 'deepseek',
-- 'geoapify', 'brave', 'resend', 'imap') and `value` holds whatever shape
-- that provider needs (a bare string API key, or a small JSON object for
-- something like IMAP's host/port/user/password).
CREATE TABLE IF NOT EXISTS credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id),
  provider text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, provider)
);

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

-- CRM-grade pipeline tracking: `status` above stays as the automation
-- lifecycle (raw/qualified/contacted/archived), driven by the agents.
-- `pipeline_stage` is the separate, human-facing sales stage a rep moves
-- a lead through by hand, with a next action and due date to track.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'New';
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_pipeline_stage_check;
ALTER TABLE leads ADD CONSTRAINT leads_pipeline_stage_check
  CHECK (pipeline_stage IN ('New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiating', 'Won', 'Lost'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_due date;
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_next_action_due ON leads(next_action_due);

-- Decision-maker enrichment: separate from the business-level email/phone
-- above, these identify a specific person to reach at the business —
-- pulled from the site's About/Team/Contact content via Jina Reader +
-- DeepSeek extraction (agents/dmEnrich.js). Never guessed; left null when
-- the source content doesn't name a real person.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_title text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_email text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_phone text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_linkedin_url text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'EN';
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_language_check;
ALTER TABLE leads ADD CONSTRAINT leads_language_check CHECK (language IN ('EN', 'FR'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_enriched_at timestamptz;

-- Multi-dimensional ICP (Ideal Customer Profile) scoring: Budget,
-- Authority, Need, Urgency, Fit — each 1-5, scored by the ICP scorer
-- agent (agents/icpScorer.js) from the qualifier's findings, DM
-- enrichment, and sector. Separate from `score` above, which measures
-- website/digital-presence opportunity, not sales-readiness.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_budget smallint;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_authority smallint;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_need smallint;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_urgency smallint;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_fit smallint;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_icp_range_check;
ALTER TABLE leads ADD CONSTRAINT leads_icp_range_check CHECK (
  (icp_budget IS NULL OR icp_budget BETWEEN 1 AND 5) AND
  (icp_authority IS NULL OR icp_authority BETWEEN 1 AND 5) AND
  (icp_need IS NULL OR icp_need BETWEEN 1 AND 5) AND
  (icp_urgency IS NULL OR icp_urgency BETWEEN 1 AND 5) AND
  (icp_fit IS NULL OR icp_fit BETWEEN 1 AND 5)
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_total smallint;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_reasoning text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_scored_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_leads_icp_total ON leads(icp_total);

-- Geographic expansion: which country a lead is in, driving phone-number
-- normalization rules and proposal currency (tools/countries.js). Defaults
-- to 'GH' since every existing lead was discovered there.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'GH';
CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);

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

-- ============================================================================
-- Multi-tenant Stage 1: agency_id backfill for every tenant-scoped table.
-- Safe to re-run: the DO block only seeds a default agency the very first
-- time (when `agencies` is empty), the ADD COLUMN/UPDATE/SET NOT NULL
-- sequence is a no-op once every row already has an agency_id, and the
-- constraint drop+recreate pairs are idempotent by construction. Child
-- tables (outreach, follow_ups, proposals, replies) are NOT given their
-- own agency_id column — they're scoped transitively via lead_id, since
-- every access path already joins through leads.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM agencies) THEN
    INSERT INTO agencies (name, owner_email, plan_tier)
    VALUES ('Tedmark Digital Agency', 'romaricromaric99@gmail.com', 'paid');
  END IF;
END $$;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE leads SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL;
ALTER TABLE leads ALTER COLUMN agency_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_agency_id ON leads(agency_id);

ALTER TABLE scout_progress ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE scout_progress SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL;
ALTER TABLE scout_progress ALTER COLUMN agency_id SET NOT NULL;
ALTER TABLE scout_progress DROP CONSTRAINT IF EXISTS scout_progress_sector_city_key;
ALTER TABLE scout_progress DROP CONSTRAINT IF EXISTS scout_progress_agency_sector_city_key;
ALTER TABLE scout_progress ADD CONSTRAINT scout_progress_agency_sector_city_key UNIQUE (agency_id, sector, city);

ALTER TABLE search_progress ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE search_progress SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL;
ALTER TABLE search_progress ALTER COLUMN agency_id SET NOT NULL;
ALTER TABLE search_progress DROP CONSTRAINT IF EXISTS search_progress_sector_city_query_type_key;
ALTER TABLE search_progress DROP CONSTRAINT IF EXISTS search_progress_agency_sector_city_query_type_key;
ALTER TABLE search_progress ADD CONSTRAINT search_progress_agency_sector_city_query_type_key UNIQUE (agency_id, sector, city, query_type);

ALTER TABLE directory_progress ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE directory_progress SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL;
ALTER TABLE directory_progress ALTER COLUMN agency_id SET NOT NULL;
ALTER TABLE directory_progress DROP CONSTRAINT IF EXISTS directory_progress_category_slug_key;
ALTER TABLE directory_progress DROP CONSTRAINT IF EXISTS directory_progress_agency_category_slug_key;
ALTER TABLE directory_progress ADD CONSTRAINT directory_progress_agency_category_slug_key UNIQUE (agency_id, category_slug);

ALTER TABLE search_api_usage ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE search_api_usage SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL;
ALTER TABLE search_api_usage ALTER COLUMN agency_id SET NOT NULL;

-- settings' primary key changes from a single global `key` to a composite
-- (agency_id, key) — each agency now gets its own independent settings row
-- per key, instead of one shared global row.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE settings SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL;
ALTER TABLE settings ALTER COLUMN agency_id SET NOT NULL;
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE settings ADD CONSTRAINT settings_pkey PRIMARY KEY (agency_id, key);

ALTER TABLE signatures ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE signatures SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL;
ALTER TABLE signatures ALTER COLUMN agency_id SET NOT NULL;

ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE knowledge_items SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL;
ALTER TABLE knowledge_items ALTER COLUMN agency_id SET NOT NULL;

ALTER TABLE analytics_snapshots ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE analytics_snapshots SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL;
ALTER TABLE analytics_snapshots ALTER COLUMN agency_id SET NOT NULL;

-- users.email stays globally unique (a login email is unique across the
-- whole platform, not per agency) — agency_id just says which agency this
-- user belongs to.
ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
UPDATE users SET agency_id = (SELECT id FROM agencies ORDER BY created_at LIMIT 1) WHERE agency_id IS NULL AND role != 'super_admin';

-- Stage 2 (auth & access): a 'super_admin' isn't tied to any single
-- agency — they can act across all of them (impersonation panel is
-- Stage 4). Every other role must belong to exactly one agency.
ALTER TABLE users ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_agency_required_unless_super_admin;
ALTER TABLE users ADD CONSTRAINT users_agency_required_unless_super_admin
  CHECK (agency_id IS NOT NULL OR role = 'super_admin');
