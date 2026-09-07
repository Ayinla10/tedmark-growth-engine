CREATE TABLE IF NOT EXISTS agent_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL,
  lead_id     UUID,
  command     TEXT NOT NULL,
  ok          BOOLEAN NOT NULL,
  output      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_runs_lead_idx
  ON agent_runs (agency_id, lead_id, created_at DESC);
