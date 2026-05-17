-- AgentQA Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SCANS
-- ============================================================
CREATE TABLE IF NOT EXISTS scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url           TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  score         INTEGER CHECK (score >= 0 AND score <= 100),
  total_pages   INTEGER NOT NULL DEFAULT 0,
  total_issues  INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  notify_email  TEXT,
  ip            TEXT,
  ai_overview   TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
-- Composite index for cache-check query: WHERE url = ? AND status = 'completed' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_scans_url_status ON scans(url, status, created_at DESC);

-- ============================================================
-- SCANNED PAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS scanned_pages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id               UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  url                   TEXT NOT NULL,
  status_code           INTEGER,
  load_time_ms          INTEGER,
  title                 TEXT,
  has_console_errors    BOOLEAN NOT NULL DEFAULT false,
  has_network_failures  BOOLEAN NOT NULL DEFAULT false,
  has_mobile_issues     BOOLEAN NOT NULL DEFAULT false,
  screenshot_url        TEXT,
  mobile_screenshot_url TEXT,
  video_url             TEXT,
  network_details       JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scanned_pages_scan_id ON scanned_pages(scan_id);

-- ============================================================
-- ISSUES
-- ============================================================
CREATE TABLE IF NOT EXISTS issues (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id        UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  page_id        UUID REFERENCES scanned_pages(id) ON DELETE SET NULL,
  type           TEXT NOT NULL,
  severity       TEXT NOT NULL CHECK (severity IN ('critical', 'medium', 'low')),
  title          TEXT NOT NULL,
  description    TEXT,
  details        JSONB,
  ai_summary     TEXT,
  root_cause     TEXT,
  fix_suggestion TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_scan_id ON issues(scan_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_page_id ON issues(page_id);

-- ============================================================
-- PAGE LOGS (console messages, errors)
-- ============================================================
CREATE TABLE IF NOT EXISTS page_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID NOT NULL REFERENCES scanned_pages(id) ON DELETE CASCADE,
  level       TEXT NOT NULL CHECK (level IN ('error', 'warning', 'info', 'log')),
  message     TEXT NOT NULL,
  source      TEXT,
  stack_trace TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_logs_page_id ON page_logs(page_id);
CREATE INDEX IF NOT EXISTS idx_page_logs_level ON page_logs(level);

-- ============================================================
-- STORAGE BUCKETS (run separately or via Supabase dashboard)
-- ============================================================
-- In Supabase dashboard: Storage > New Bucket > "screenshots" > Public
-- Same bucket is used for videos (stored under videos/{scanId}/{pageId}.webm)
-- and mobile screenshots (stored under {scanId}/{pageId}-mobile.png)
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('screenshots', 'screenshots', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Public read access" ON storage.objects
--   FOR SELECT USING (bucket_id = 'screenshots');
--
-- CREATE POLICY "Service role upload" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'screenshots');

-- ============================================================
-- ROW LEVEL SECURITY (permissive for MVP - no auth)
-- ============================================================
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations from anon key (MVP - add auth later)
CREATE POLICY "Public access to scans" ON scans FOR ALL USING (true);
CREATE POLICY "Public access to scanned_pages" ON scanned_pages FOR ALL USING (true);
CREATE POLICY "Public access to issues" ON issues FOR ALL USING (true);
CREATE POLICY "Public access to page_logs" ON page_logs FOR ALL USING (true);

-- ============================================================
-- SCAN LOGS (real-time progress visible in dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_logs (
  id          BIGSERIAL PRIMARY KEY,
  scan_id     UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_logs_scan_id ON scan_logs(scan_id);

ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to scan_logs" ON scan_logs FOR ALL USING (true);

-- ============================================================
-- WAITLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only on waitlist" ON waitlist FOR ALL USING (false);

-- ============================================================
-- AI MOAT: FRAMEWORK DETECTION
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_frameworks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  framework   TEXT NOT NULL,
  confidence  REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  signals     TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_frameworks_scan_id ON scan_frameworks(scan_id);

ALTER TABLE scan_frameworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to scan_frameworks" ON scan_frameworks FOR ALL USING (true);

-- ============================================================
-- AI MOAT: CROSS-SCAN ISSUE PATTERNS
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_patterns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint          TEXT NOT NULL UNIQUE,
  type                 TEXT NOT NULL,
  severity             TEXT NOT NULL,
  title                TEXT NOT NULL,
  occurrence_count     INTEGER NOT NULL DEFAULT 1,
  affected_frameworks  TEXT[] NOT NULL DEFAULT '{}',
  root_cause_template  TEXT,
  fix_template         TEXT,
  first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_patterns_fingerprint ON issue_patterns(fingerprint);
CREATE INDEX IF NOT EXISTS idx_issue_patterns_type ON issue_patterns(type);
CREATE INDEX IF NOT EXISTS idx_issue_patterns_count ON issue_patterns(occurrence_count DESC);

ALTER TABLE issue_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to issue_patterns" ON issue_patterns FOR ALL USING (true);

-- ============================================================
-- AI MOAT: ISSUE → PATTERN LINKS
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_pattern_matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  pattern_id  UUID NOT NULL REFERENCES issue_patterns(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (issue_id, pattern_id)
);

CREATE INDEX IF NOT EXISTS idx_ipm_issue_id    ON issue_pattern_matches(issue_id);
CREATE INDEX IF NOT EXISTS idx_ipm_pattern_id  ON issue_pattern_matches(pattern_id);

ALTER TABLE issue_pattern_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to issue_pattern_matches" ON issue_pattern_matches FOR ALL USING (true);

-- New columns on issues for moat layer
ALTER TABLE issues ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS framework   TEXT;

CREATE INDEX IF NOT EXISTS idx_issues_fingerprint ON issues(fingerprint) WHERE fingerprint IS NOT NULL;

-- ============================================================
-- PHASE 4 — RECURRING SCANS & RELIABILITY INTELLIGENCE
-- ============================================================

-- ── Scheduled scans ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scan_schedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain                TEXT NOT NULL,
  url                   TEXT NOT NULL,
  cadence               TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'manual', 'webhook')),
  notify_email          TEXT NOT NULL,
  is_internal           BOOLEAN NOT NULL DEFAULT false,
  enabled               BOOLEAN NOT NULL DEFAULT true,
  webhook_secret        TEXT,
  last_run_at           TIMESTAMPTZ,
  last_scan_id          UUID,
  next_run_at           TIMESTAMPTZ NOT NULL,
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  paused_reason         TEXT,
  created_by_ip         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Free-tier: 1 active schedule per domain (internal accounts are exempt)
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_domain_free
  ON scan_schedules (domain) WHERE is_internal = false AND enabled = true;

CREATE INDEX IF NOT EXISTS idx_schedules_due
  ON scan_schedules (next_run_at) WHERE enabled = true AND paused_reason IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_email  ON scan_schedules (notify_email);
CREATE INDEX IF NOT EXISTS idx_schedules_domain ON scan_schedules (domain);

ALTER TABLE scan_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to scan_schedules" ON scan_schedules FOR ALL USING (true);

-- ── Scan run history (links schedules → scans) ────────────────────────────────

CREATE TABLE IF NOT EXISTS scan_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID NOT NULL REFERENCES scan_schedules(id) ON DELETE CASCADE,
  scan_id      UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('cron', 'webhook', 'manual', 'retry')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_id, scan_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_runs_schedule ON scan_runs (schedule_id, created_at DESC);

ALTER TABLE scan_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to scan_runs" ON scan_runs FOR ALL USING (true);

-- ── Per-fingerprint regression detail ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scan_regressions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id        UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  prev_scan_id   UUID REFERENCES scans(id) ON DELETE SET NULL,
  schedule_id    UUID REFERENCES scan_schedules(id) ON DELETE SET NULL,
  domain         TEXT NOT NULL,
  fingerprint    TEXT NOT NULL,
  issue_type     TEXT NOT NULL,
  severity       TEXT NOT NULL,
  change_kind    TEXT NOT NULL CHECK (change_kind IN ('new', 'resolved', 'recurring', 'worsened', 'improved')),
  prev_severity  TEXT,
  curr_severity  TEXT,
  prev_count     INTEGER NOT NULL DEFAULT 0,
  curr_count     INTEGER NOT NULL DEFAULT 0,
  first_seen_at  TIMESTAMPTZ,
  days_unresolved INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scan_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_regr_scan_kind   ON scan_regressions (scan_id, change_kind);
CREATE INDEX IF NOT EXISTS idx_regr_domain_fp   ON scan_regressions (domain, fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regr_schedule    ON scan_regressions (schedule_id, created_at DESC);

ALTER TABLE scan_regressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to scan_regressions" ON scan_regressions FOR ALL USING (true);

-- ── Per-domain × fingerprint issue memory ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS domain_issue_state (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain                  TEXT NOT NULL,
  fingerprint             TEXT NOT NULL,
  pattern_id              UUID REFERENCES issue_patterns(id) ON DELETE SET NULL,
  first_seen_at           TIMESTAMPTZ NOT NULL,
  first_seen_scan_id      UUID REFERENCES scans(id) ON DELETE SET NULL,
  last_seen_at            TIMESTAMPTZ NOT NULL,
  last_seen_scan_id       UUID REFERENCES scans(id) ON DELETE SET NULL,
  last_resolved_at        TIMESTAMPTZ,
  last_resolved_scan_id   UUID REFERENCES scans(id) ON DELETE SET NULL,
  total_occurrences       INTEGER NOT NULL DEFAULT 1,
  consecutive_scans_seen  INTEGER NOT NULL DEFAULT 1,
  consecutive_scans_clean INTEGER NOT NULL DEFAULT 0,
  current_status          TEXT NOT NULL CHECK (current_status IN ('open', 'resolved', 'recurring')),
  current_severity        TEXT,
  resolution_count        INTEGER NOT NULL DEFAULT 0,
  reopen_count            INTEGER NOT NULL DEFAULT 0,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (domain, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_dis_domain_status ON domain_issue_state (domain, current_status);
CREATE INDEX IF NOT EXISTS idx_dis_fingerprint   ON domain_issue_state (fingerprint);
CREATE INDEX IF NOT EXISTS idx_dis_severity      ON domain_issue_state (current_severity, current_status);

ALTER TABLE domain_issue_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to domain_issue_state" ON domain_issue_state FOR ALL USING (true);

-- ── Alerting scaffold (architecture only — dispatcher not yet active) ─────────

CREATE TABLE IF NOT EXISTS alert_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id      UUID REFERENCES scan_schedules(id) ON DELETE CASCADE,
  domain           TEXT,
  rule_kind        TEXT NOT NULL CHECK (rule_kind IN (
                     'score_drop', 'new_critical', 'unresolved_days',
                     'regression_count', 'any_new_regression', 'fix_verified'
                   )),
  threshold        JSONB NOT NULL DEFAULT '{}',
  channel          TEXT NOT NULL CHECK (channel IN ('email', 'webhook', 'slack')),
  channel_target   TEXT NOT NULL,
  channel_secret   TEXT,
  enabled          BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  last_fired_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_schedule ON alert_rules (schedule_id) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_rules_domain   ON alert_rules (domain) WHERE enabled = true;

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to alert_rules" ON alert_rules FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS alert_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  scan_id       UUID REFERENCES scans(id) ON DELETE SET NULL,
  payload       JSONB NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'suppressed')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_pending ON alert_events (scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_alert_events_rule    ON alert_events (rule_id, created_at DESC);

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to alert_events" ON alert_events FOR ALL USING (true);

-- ── Additive columns on existing tables ──────────────────────────────────────

-- scans: reliability tracking
ALTER TABLE scans ADD COLUMN IF NOT EXISTS domain           TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS schedule_id      UUID REFERENCES scan_schedules(id) ON DELETE SET NULL;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS prev_scan_id     UUID REFERENCES scans(id) ON DELETE SET NULL;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS regression_recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS regression_worsened  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS regression_improved  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS score_delta      INTEGER;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS run_sequence     INTEGER;

-- Also add AI token columns if not present (may be from prior migration)
ALTER TABLE scans ADD COLUMN IF NOT EXISTS ai_tokens_in     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS ai_tokens_out    INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_scans_domain_completed
  ON scans (domain, completed_at DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_scans_schedule
  ON scans (schedule_id, completed_at DESC) WHERE schedule_id IS NOT NULL;

-- issue_patterns: global intelligence enrichment
ALTER TABLE issue_patterns ADD COLUMN IF NOT EXISTS recurrence_count      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE issue_patterns ADD COLUMN IF NOT EXISTS global_first_seen_at  TIMESTAMPTZ;
ALTER TABLE issue_patterns ADD COLUMN IF NOT EXISTS global_last_resolved_at TIMESTAMPTZ;
ALTER TABLE issue_patterns ADD COLUMN IF NOT EXISTS avg_days_to_resolve   REAL;

-- issues: additional fields for analysis view
ALTER TABLE issues ADD COLUMN IF NOT EXISTS fix_helpful         BOOLEAN;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS confidence          REAL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS from_pattern        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS analyzed_at         TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS model_version       TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS analysis_version    INTEGER;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS cluster_key         TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS cluster_id          TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS pattern_id          UUID REFERENCES issue_patterns(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS pattern_count       INTEGER;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS pattern_needs_refresh BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS pattern_feedback_positive INTEGER NOT NULL DEFAULT 0;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS pattern_feedback_negative INTEGER NOT NULL DEFAULT 0;

-- ── SQL Functions ─────────────────────────────────────────────────────────────

-- Claim due scheduled scans atomically (FOR UPDATE SKIP LOCKED prevents double-claim)
CREATE OR REPLACE FUNCTION agentqa_claim_due_schedules(p_limit INT DEFAULT 5)
RETURNS TABLE(
  id            UUID,
  url           TEXT,
  domain        TEXT,
  notify_email  TEXT,
  cadence       TEXT,
  webhook_secret TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE scan_schedules s
  SET
    last_run_at = NOW(),
    updated_at  = NOW(),
    next_run_at = CASE s.cadence
                    WHEN 'daily'  THEN NOW() + INTERVAL '1 day'
                    WHEN 'weekly' THEN NOW() + INTERVAL '7 days'
                    ELSE s.next_run_at
                  END
  WHERE s.id IN (
    SELECT ss.id
    FROM   scan_schedules ss
    WHERE  ss.enabled = true
      AND  ss.paused_reason IS NULL
      AND  ss.next_run_at <= NOW()
      AND  ss.cadence IN ('daily', 'weekly')
    ORDER BY ss.next_run_at
    LIMIT  p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING s.id, s.url, s.domain, s.notify_email, s.cadence, s.webhook_secret;
END;
$$;

-- Compute per-fingerprint regression diff and populate scan_regressions
CREATE OR REPLACE FUNCTION agentqa_compute_regressions(p_scan_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_scan         RECORD;
  v_domain       TEXT;
  v_prev_scan_id UUID;
BEGIN
  SELECT url, domain, prev_scan_id, schedule_id, completed_at
    INTO v_scan
    FROM scans
   WHERE id = p_scan_id;

  v_domain       := COALESCE(v_scan.domain, regexp_replace(v_scan.url, 'https?://([^/]+).*', '\1'));
  v_prev_scan_id := v_scan.prev_scan_id;

  IF v_prev_scan_id IS NULL THEN
    -- First scan for this domain — mark all as new
    INSERT INTO scan_regressions (
      scan_id, prev_scan_id, schedule_id, domain,
      fingerprint, issue_type, severity,
      change_kind, curr_severity, curr_count, first_seen_at, days_unresolved
    )
    SELECT
      p_scan_id, NULL, v_scan.schedule_id, v_domain,
      i.fingerprint, i.type, i.severity,
      'new', i.severity, COUNT(*), MIN(i.created_at), 0
    FROM issues i
    WHERE i.scan_id = p_scan_id
      AND i.fingerprint IS NOT NULL
    GROUP BY i.fingerprint, i.type, i.severity
    ON CONFLICT (scan_id, fingerprint) DO NOTHING;
    RETURN;
  END IF;

  -- Full diff: current vs previous fingerprints
  INSERT INTO scan_regressions (
    scan_id, prev_scan_id, schedule_id, domain,
    fingerprint, issue_type, severity,
    change_kind, prev_severity, curr_severity,
    prev_count, curr_count, first_seen_at, days_unresolved
  )
  WITH curr AS (
    SELECT fingerprint, type, severity, COUNT(*) AS cnt
      FROM issues
     WHERE scan_id = p_scan_id AND fingerprint IS NOT NULL
     GROUP BY fingerprint, type, severity
  ),
  prev AS (
    SELECT fingerprint, type, severity, COUNT(*) AS cnt
      FROM issues
     WHERE scan_id = v_prev_scan_id AND fingerprint IS NOT NULL
     GROUP BY fingerprint, type, severity
  ),
  dis AS (
    SELECT fingerprint, first_seen_at, current_status
      FROM domain_issue_state
     WHERE domain = v_domain
  )
  SELECT
    p_scan_id,
    v_prev_scan_id,
    v_scan.schedule_id,
    v_domain,
    COALESCE(c.fingerprint, p.fingerprint),
    COALESCE(c.type, p.type),
    COALESCE(c.severity, p.severity),
    CASE
      WHEN c.fingerprint IS NULL                              THEN 'resolved'
      WHEN p.fingerprint IS NULL                              THEN 'new'
      WHEN c.severity > p.severity                           THEN 'worsened'
      WHEN c.severity < p.severity                           THEN 'improved'
      ELSE                                                        'recurring'
    END,
    p.severity,
    c.severity,
    COALESCE(p.cnt, 0),
    COALESCE(c.cnt, 0),
    dis.first_seen_at,
    CASE
      WHEN dis.first_seen_at IS NOT NULL
       AND (c.fingerprint IS NOT NULL)
      THEN GREATEST(0, EXTRACT(DAY FROM (NOW() - dis.first_seen_at))::INTEGER)
      ELSE 0
    END
  FROM curr c
  FULL OUTER JOIN prev p USING (fingerprint)
  LEFT JOIN dis ON dis.fingerprint = COALESCE(c.fingerprint, p.fingerprint)
  ON CONFLICT (scan_id, fingerprint) DO NOTHING;

  -- Roll up counts back to scans table
  UPDATE scans
  SET
    regression_new       = (SELECT COUNT(*) FROM scan_regressions WHERE scan_id = p_scan_id AND change_kind = 'new'),
    regression_resolved  = (SELECT COUNT(*) FROM scan_regressions WHERE scan_id = p_scan_id AND change_kind = 'resolved'),
    regression_recurring = (SELECT COUNT(*) FROM scan_regressions WHERE scan_id = p_scan_id AND change_kind = 'recurring'),
    regression_worsened  = (SELECT COUNT(*) FROM scan_regressions WHERE scan_id = p_scan_id AND change_kind = 'worsened'),
    regression_improved  = (SELECT COUNT(*) FROM scan_regressions WHERE scan_id = p_scan_id AND change_kind = 'improved')
  WHERE id = p_scan_id;
END;
$$;

-- Update domain_issue_state after a scan completes
CREATE OR REPLACE FUNCTION agentqa_apply_scan_to_state(p_scan_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_domain       TEXT;
  v_completed_at TIMESTAMPTZ;
  v_prev_scan_id UUID;
BEGIN
  SELECT
    COALESCE(domain, regexp_replace(url, 'https?://([^/]+).*', '\1')),
    completed_at,
    prev_scan_id
  INTO v_domain, v_completed_at, v_prev_scan_id
  FROM scans
  WHERE id = p_scan_id;

  v_completed_at := COALESCE(v_completed_at, NOW());

  -- Upsert state for every fingerprint in the current scan
  INSERT INTO domain_issue_state (
    domain, fingerprint, first_seen_at, first_seen_scan_id,
    last_seen_at, last_seen_scan_id,
    total_occurrences, consecutive_scans_seen, consecutive_scans_clean,
    current_status, current_severity, updated_at
  )
  SELECT
    v_domain,
    i.fingerprint,
    v_completed_at, p_scan_id,
    v_completed_at, p_scan_id,
    1, 1, 0,
    'open', i.severity, NOW()
  FROM (
    SELECT DISTINCT fingerprint, severity
    FROM issues
    WHERE scan_id = p_scan_id AND fingerprint IS NOT NULL
  ) i
  ON CONFLICT (domain, fingerprint) DO UPDATE
    SET
      last_seen_at           = EXCLUDED.last_seen_at,
      last_seen_scan_id      = EXCLUDED.last_seen_scan_id,
      total_occurrences      = domain_issue_state.total_occurrences + 1,
      consecutive_scans_seen = CASE
        WHEN domain_issue_state.current_status = 'resolved' THEN 1
        ELSE domain_issue_state.consecutive_scans_seen + 1
      END,
      consecutive_scans_clean = 0,
      current_status = CASE
        WHEN domain_issue_state.current_status = 'resolved' THEN 'recurring'
        ELSE 'open'
      END,
      reopen_count = domain_issue_state.reopen_count + CASE
        WHEN domain_issue_state.current_status = 'resolved' THEN 1
        ELSE 0
      END,
      current_severity = EXCLUDED.current_severity,
      updated_at = NOW();

  -- Mark resolved: fingerprints in prev scan but NOT in current scan
  IF v_prev_scan_id IS NOT NULL THEN
    UPDATE domain_issue_state dis
    SET
      current_status          = 'resolved',
      last_resolved_at        = v_completed_at,
      last_resolved_scan_id   = p_scan_id,
      consecutive_scans_clean = dis.consecutive_scans_clean + 1,
      consecutive_scans_seen  = 0,
      resolution_count        = dis.resolution_count + 1,
      updated_at              = NOW()
    WHERE dis.domain = v_domain
      AND dis.current_status <> 'resolved'
      AND dis.fingerprint IN (
        SELECT fingerprint FROM issues
        WHERE scan_id = v_prev_scan_id AND fingerprint IS NOT NULL
      )
      AND dis.fingerprint NOT IN (
        SELECT fingerprint FROM issues
        WHERE scan_id = p_scan_id AND fingerprint IS NOT NULL
      );
  END IF;
END;
$$;

-- ── MIGRATION: run these if upgrading an existing database ────────────────────
-- ============================================================
-- MIGRATION: run these if upgrading an existing database
-- ============================================================
-- Phase 2 — AI Intelligence Layer
-- ALTER TABLE scans ADD COLUMN IF NOT EXISTS ai_overview TEXT;
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS ai_summary TEXT;
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS root_cause TEXT;
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS fix_suggestion TEXT;
--
-- ALTER TABLE scans ADD COLUMN IF NOT EXISTS notify_email TEXT;
-- ALTER TABLE scans ADD COLUMN IF NOT EXISTS ip TEXT;
-- ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS has_mobile_issues BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS mobile_screenshot_url TEXT;
-- ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS video_url TEXT;
-- ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS network_details JSONB;
-- ALTER TABLE page_logs ADD COLUMN IF NOT EXISTS stack_trace TEXT;
-- CREATE TABLE IF NOT EXISTS waitlist ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );
-- CREATE TABLE IF NOT EXISTS scan_logs ( id BIGSERIAL PRIMARY KEY, scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE, message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );
-- CREATE INDEX IF NOT EXISTS idx_scan_logs_scan_id ON scan_logs(scan_id);
-- ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public access to scan_logs" ON scan_logs FOR ALL USING (true);
-- CREATE INDEX IF NOT EXISTS idx_scans_url_status ON scans(url, status, created_at DESC);
-- Phase 3 — AI Moat Layer
-- CREATE TABLE IF NOT EXISTS scan_frameworks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE, framework TEXT NOT NULL, confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1), signals TEXT[] NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
-- CREATE TABLE IF NOT EXISTS issue_patterns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fingerprint TEXT NOT NULL UNIQUE, type TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, occurrence_count INTEGER NOT NULL DEFAULT 1, affected_frameworks TEXT[] NOT NULL DEFAULT '{}', root_cause_template TEXT, fix_template TEXT, first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
-- CREATE TABLE IF NOT EXISTS issue_pattern_matches (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE, pattern_id UUID NOT NULL REFERENCES issue_patterns(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (issue_id, pattern_id));
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS fingerprint TEXT;
-- ALTER TABLE issues ADD COLUMN IF NOT EXISTS framework TEXT;
