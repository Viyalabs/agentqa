-- ============================================================
-- Migration 003 — Async AI Analysis Job Queue
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_analysis_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  job_type      TEXT        NOT NULL CHECK (job_type IN ('issue_batch', 'scan_overview')),
  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  priority      INTEGER     NOT NULL DEFAULT 10,
  attempts      INTEGER     NOT NULL DEFAULT 0,
  last_error    TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

-- Worker claim query: pending jobs ordered by priority, then age
CREATE INDEX IF NOT EXISTS idx_aaj_claim
  ON ai_analysis_jobs (status, scheduled_at, priority, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_aaj_scan_id
  ON ai_analysis_jobs (scan_id);

ALTER TABLE ai_analysis_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access to ai_analysis_jobs"
  ON ai_analysis_jobs FOR ALL USING (true);
