#!/usr/bin/env node
/**
 * AgentQA — Supabase migration runner
 * Usage: node scripts/migrate.js
 *
 * Reads credentials from .env.local and applies the full schema via a
 * direct Postgres connection (not the Management API, which requires a PAT).
 *
 * Required in .env.local — use ONE of these connection options (tried in order):
 *
 *   SUPABASE_ACCESS_TOKEN  ← RECOMMENDED — works on any network, no port 5432 needed
 *     supabase.com/dashboard/account/tokens → "Generate new token"
 *     Uses the Supabase Management API over HTTPS (port 443).
 *
 *   SUPABASE_POOLER_URL  (session-mode pooler — IPv4, port 5432)
 *     Dashboard → Project Settings → Database → Connection Pooling → Session mode → URI
 *
 *   SUPABASE_DB_URL / SUPABASE_DB_PASSWORD  (direct — IPv6 only, may fail on some networks)
 */

const fs   = require('fs')
const path = require('path')
const { Client } = require('pg')

// Returns true when a URL points to the direct host (IPv6-only on many ISPs)
function isDirectUrl(url) {
  return /db\.[a-z0-9]+\.supabase\.co/i.test(url)
}

// ── Load .env.local ───────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('\n  .env.local not found.')
    console.error('   Copy .env.example -> .env.local and fill in your credentials.\n')
    process.exit(1)
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL
const ACCESS_TOKEN    = process.env.SUPABASE_ACCESS_TOKEN   // PAT — HTTPS, works anywhere
const DB_PASSWORD     = process.env.SUPABASE_DB_PASSWORD
const POOLER_URL      = process.env.SUPABASE_POOLER_URL
const DB_URL_DIRECT   = process.env.SUPABASE_DB_URL
// Standard vars injected by the Supabase-Vercel integration (vercel env pull)
const POSTGRES_URL           = process.env.POSTGRES_URL             // transaction pooler (port 6543)
const POSTGRES_URL_NONPOOL   = process.env.POSTGRES_URL_NON_POOLING // direct (IPv6) — fallback only

if (!SUPABASE_URL || SUPABASE_URL.includes('your-project')) {
  console.error('\n  NEXT_PUBLIC_SUPABASE_URL is not set in .env.local\n')
  process.exit(1)
}

const PROJECT_REF = SUPABASE_URL.replace('https://', '').split('.')[0]

// Derive a session-mode pooler URL (port 5432) from the Vercel transaction pooler URL
// by stripping pgbouncer params and switching port. Session mode supports DDL.
function toSessionPooler(url) {
  if (!url || !url.includes('.pooler.supabase.com')) return null
  return url
    .replace(':6543/', ':5432/')
    .replace(/[?&]pgbouncer=true/g, '')
    .replace(/[?&]connection_limit=\d+/g, '')
    .replace(/\?$/, '')
}

let DB_URL
let DB_HOST

if (!ACCESS_TOKEN) {
  const sessionFromVercel = toSessionPooler(POSTGRES_URL)

  if (POOLER_URL && !isDirectUrl(POOLER_URL)) {
    DB_URL  = POOLER_URL
    DB_HOST = POOLER_URL.split('@')[1]?.split(':')[0] ?? 'pooler'
  } else if (sessionFromVercel) {
    // Derived from POSTGRES_URL injected by Supabase-Vercel integration
    DB_URL  = sessionFromVercel
    DB_HOST = sessionFromVercel.split('@')[1]?.split(':')[0] ?? 'pooler'
  } else if (DB_URL_DIRECT) {
    DB_URL  = DB_URL_DIRECT
    DB_HOST = DB_URL_DIRECT.split('@')[1]?.split(':')[0] ?? 'direct'
  } else if (DB_PASSWORD) {
    DB_HOST = `db.${PROJECT_REF}.supabase.co`
    DB_URL  = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:5432/postgres`
  }
}

// ── SQL steps ─────────────────────────────────────────────────────────────────

const steps = [
  {
    label: 'Enable pgcrypto extension',
    sql: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
  },
  {
    label: 'Create scans table',
    sql: `
CREATE TABLE IF NOT EXISTS scans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url           TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','running','completed','failed')),
  score         INTEGER     CHECK (score >= 0 AND score <= 100),
  total_pages   INTEGER     NOT NULL DEFAULT 0,
  total_issues  INTEGER     NOT NULL DEFAULT 0,
  error_message TEXT,
  notify_email  TEXT,
  ip            TEXT,
  ai_overview   TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scans_status     ON scans (status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_url_status ON scans (url, status, created_at DESC);`
  },
  {
    label: 'Create scanned_pages table',
    sql: `
CREATE TABLE IF NOT EXISTS scanned_pages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id               UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  url                   TEXT        NOT NULL,
  status_code           INTEGER,
  load_time_ms          INTEGER,
  title                 TEXT,
  has_console_errors    BOOLEAN     NOT NULL DEFAULT false,
  has_network_failures  BOOLEAN     NOT NULL DEFAULT false,
  has_mobile_issues     BOOLEAN     NOT NULL DEFAULT false,
  screenshot_url        TEXT,
  mobile_screenshot_url TEXT,
  video_url             TEXT,
  network_details       JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scanned_pages_scan_id ON scanned_pages (scan_id);`
  },
  {
    label: 'Create issues table',
    sql: `
CREATE TABLE IF NOT EXISTS issues (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id        UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  page_id        UUID        REFERENCES scanned_pages(id) ON DELETE SET NULL,
  type           TEXT        NOT NULL,
  severity       TEXT        NOT NULL CHECK (severity IN ('critical','medium','low')),
  title          TEXT        NOT NULL,
  description    TEXT,
  details        JSONB,
  ai_summary     TEXT,
  root_cause     TEXT,
  fix_suggestion TEXT,
  fingerprint    TEXT,
  framework      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_issues_scan_id     ON issues (scan_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity    ON issues (severity);
CREATE INDEX IF NOT EXISTS idx_issues_page_id     ON issues (page_id);
CREATE INDEX IF NOT EXISTS idx_issues_fingerprint ON issues (fingerprint) WHERE fingerprint IS NOT NULL;`
  },
  {
    label: 'Create page_logs table',
    sql: `
CREATE TABLE IF NOT EXISTS page_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID        NOT NULL REFERENCES scanned_pages(id) ON DELETE CASCADE,
  level       TEXT        NOT NULL CHECK (level IN ('error','warning','info','log')),
  message     TEXT        NOT NULL,
  source      TEXT,
  stack_trace TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_logs_page_id ON page_logs (page_id);
CREATE INDEX IF NOT EXISTS idx_page_logs_level   ON page_logs (level);`
  },
  {
    label: 'Create scan_logs table',
    sql: `
CREATE TABLE IF NOT EXISTS scan_logs (
  id         BIGSERIAL   PRIMARY KEY,
  scan_id    UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scan_id ON scan_logs (scan_id);`
  },
  {
    label: 'Create waitlist table',
    sql: `
CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL UNIQUE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_email      ON waitlist (email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist (created_at DESC);`
  },
  {
    label: 'Create scan_frameworks table',
    sql: `
CREATE TABLE IF NOT EXISTS scan_frameworks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id    UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  framework  TEXT        NOT NULL,
  confidence REAL        NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  signals    TEXT[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scan_frameworks_scan_id ON scan_frameworks (scan_id);`
  },
  {
    label: 'Create issue_patterns table',
    sql: `
CREATE TABLE IF NOT EXISTS issue_patterns (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint          TEXT        NOT NULL UNIQUE,
  type                 TEXT        NOT NULL,
  severity             TEXT        NOT NULL,
  title                TEXT        NOT NULL,
  occurrence_count     INTEGER     NOT NULL DEFAULT 1,
  total_scans_affected INTEGER     NOT NULL DEFAULT 0,
  affected_frameworks  TEXT[]      NOT NULL DEFAULT '{}',
  root_cause_template  TEXT,
  fix_template         TEXT,
  template_version     INTEGER     NOT NULL DEFAULT 1,
  template_updated_at  TIMESTAMPTZ,
  last_model_version   TEXT,
  confidence_score     REAL        CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  example_raw          TEXT,
  metadata             JSONB       NOT NULL DEFAULT '{}',
  first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ip_fingerprint      ON issue_patterns (fingerprint);
CREATE INDEX IF NOT EXISTS idx_ip_type             ON issue_patterns (type);
CREATE INDEX IF NOT EXISTS idx_ip_occurrence_count ON issue_patterns (occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_ip_total_scans      ON issue_patterns (total_scans_affected DESC);
CREATE INDEX IF NOT EXISTS idx_ip_confidence_score ON issue_patterns (confidence_score DESC) WHERE confidence_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_template_updated ON issue_patterns (template_updated_at ASC) WHERE template_updated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_frameworks_gin   ON issue_patterns USING GIN (affected_frameworks);
CREATE INDEX IF NOT EXISTS idx_ip_metadata_gin     ON issue_patterns USING GIN (metadata);`
  },
  {
    label: 'Create issue_pattern_matches table',
    sql: `
CREATE TABLE IF NOT EXISTS issue_pattern_matches (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id   UUID        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  pattern_id UUID        NOT NULL REFERENCES issue_patterns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (issue_id, pattern_id)
);
CREATE INDEX IF NOT EXISTS idx_ipm_issue_id   ON issue_pattern_matches (issue_id);
CREATE INDEX IF NOT EXISTS idx_ipm_pattern_id ON issue_pattern_matches (pattern_id);`
  },
  {
    label: 'Create issues_enriched table',
    sql: `
CREATE TABLE IF NOT EXISTS issues_enriched (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id         UUID        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  summary          TEXT        NOT NULL,
  root_cause       TEXT        NOT NULL,
  fix_suggestion   TEXT        NOT NULL,
  confidence       REAL        CHECK (confidence >= 0.0 AND confidence <= 1.0),
  analysis_data    JSONB       NOT NULL DEFAULT '{}',
  model_version    TEXT        NOT NULL,
  analysis_version INTEGER     NOT NULL DEFAULT 1,
  from_pattern     BOOLEAN     NOT NULL DEFAULT false,
  pattern_id       UUID        REFERENCES issue_patterns(id) ON DELETE SET NULL,
  analyzed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (issue_id)
);
CREATE INDEX IF NOT EXISTS idx_ie_issue_id       ON issues_enriched (issue_id);
CREATE INDEX IF NOT EXISTS idx_ie_pattern_id     ON issues_enriched (pattern_id) WHERE pattern_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ie_analyzed_at    ON issues_enriched (analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ie_model_version  ON issues_enriched (model_version) WHERE model_version IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ie_confidence     ON issues_enriched (confidence) WHERE confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ie_model_analyzed ON issues_enriched (model_version, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ie_analysis_gin   ON issues_enriched USING GIN (analysis_data);`
  },
  {
    label: 'Create pattern_occurrences table',
    sql: `
CREATE TABLE IF NOT EXISTS pattern_occurrences (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id  UUID        NOT NULL REFERENCES issue_patterns(id) ON DELETE CASCADE,
  scan_id     UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  framework   TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pattern_id, scan_id)
);
CREATE INDEX IF NOT EXISTS idx_po_pattern_time ON pattern_occurrences (pattern_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_scan_id      ON pattern_occurrences (scan_id);
CREATE INDEX IF NOT EXISTS idx_po_occurred_at  ON pattern_occurrences (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_framework    ON pattern_occurrences (framework, occurred_at DESC) WHERE framework IS NOT NULL;`
  },
  {
    label: 'Enable Row Level Security on all tables',
    sql: `
ALTER TABLE scans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_pages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues                ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_frameworks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_patterns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_pattern_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues_enriched       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_occurrences   ENABLE ROW LEVEL SECURITY;`
  },
  {
    label: 'Create RLS policies',
    sql: `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scans' AND policyname='Public access to scans') THEN
    CREATE POLICY "Public access to scans" ON scans FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scanned_pages' AND policyname='Public access to scanned_pages') THEN
    CREATE POLICY "Public access to scanned_pages" ON scanned_pages FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='issues' AND policyname='Public access to issues') THEN
    CREATE POLICY "Public access to issues" ON issues FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_logs' AND policyname='Public access to page_logs') THEN
    CREATE POLICY "Public access to page_logs" ON page_logs FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scan_logs' AND policyname='Public access to scan_logs') THEN
    CREATE POLICY "Public access to scan_logs" ON scan_logs FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waitlist' AND policyname='Service role only on waitlist') THEN
    CREATE POLICY "Service role only on waitlist" ON waitlist FOR ALL USING (false); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scan_frameworks' AND policyname='Public access to scan_frameworks') THEN
    CREATE POLICY "Public access to scan_frameworks" ON scan_frameworks FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='issue_patterns' AND policyname='Public access to issue_patterns') THEN
    CREATE POLICY "Public access to issue_patterns" ON issue_patterns FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='issue_pattern_matches' AND policyname='Public access to issue_pattern_matches') THEN
    CREATE POLICY "Public access to issue_pattern_matches" ON issue_pattern_matches FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='issues_enriched' AND policyname='Public access to issues_enriched') THEN
    CREATE POLICY "Public access to issues_enriched" ON issues_enriched FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pattern_occurrences' AND policyname='Public access to pattern_occurrences') THEN
    CREATE POLICY "Public access to pattern_occurrences" ON pattern_occurrences FOR ALL USING (true); END IF;
END $$;`
  },
  {
    label: 'Create updated_at trigger',
    sql: `
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_issues_enriched_updated_at ON issues_enriched;
CREATE TRIGGER trg_issues_enriched_updated_at
  BEFORE UPDATE ON issues_enriched
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();`
  },
  {
    label: 'Create issues_with_analysis view',
    sql: `
CREATE OR REPLACE VIEW issues_with_analysis AS
SELECT
  i.id, i.scan_id, i.page_id, i.type, i.severity, i.title,
  i.description, i.details, i.fingerprint, i.framework, i.created_at,
  ie.summary       AS ai_summary,
  ie.root_cause,
  ie.fix_suggestion,
  ie.confidence,
  ie.analysis_data,
  ie.model_version,
  ie.analysis_version,
  ie.from_pattern,
  ie.pattern_id,
  ie.analyzed_at,
  ip.occurrence_count    AS pattern_count,
  ip.affected_frameworks AS pattern_frameworks,
  ip.total_scans_affected
FROM issues i
LEFT JOIN issues_enriched ie ON ie.issue_id = i.id
LEFT JOIN issue_patterns  ip ON ip.id = ie.pattern_id;`
  },
  {
    label: 'Backfill issues_enriched from existing AI data',
    sql: `
INSERT INTO issues_enriched (
  issue_id, summary, root_cause, fix_suggestion,
  confidence, analysis_data, model_version,
  analysis_version, from_pattern, pattern_id, analyzed_at
)
SELECT
  i.id,
  i.ai_summary,
  COALESCE(i.root_cause, ''),
  COALESCE(i.fix_suggestion, ''),
  NULL, '{}'::JSONB,
  'claude-haiku-4-5-20251001',
  1,
  (ipm.pattern_id IS NOT NULL),
  ipm.pattern_id,
  i.created_at
FROM issues i
LEFT JOIN issue_pattern_matches ipm ON ipm.issue_id = i.id
WHERE i.ai_summary IS NOT NULL
ON CONFLICT (issue_id) DO NOTHING;`
  },
  {
    label: 'Backfill pattern_occurrences from existing matches',
    sql: `
INSERT INTO pattern_occurrences (pattern_id, scan_id, framework, occurred_at)
SELECT
  ipm.pattern_id, i.scan_id,
  (SELECT sf.framework FROM scan_frameworks sf
   WHERE sf.scan_id = i.scan_id ORDER BY sf.confidence DESC LIMIT 1),
  MIN(ipm.created_at)
FROM issue_pattern_matches ipm
JOIN issues i ON i.id = ipm.issue_id
GROUP BY ipm.pattern_id, i.scan_id
ON CONFLICT (pattern_id, scan_id) DO NOTHING;`
  },

  // ── Migration 003 ─────────────────────────────────────────────────────────────
  {
    label: 'Create ai_analysis_jobs table',
    sql: `
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
CREATE INDEX IF NOT EXISTS idx_aaj_claim
  ON ai_analysis_jobs (status, scheduled_at, priority, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_aaj_scan_id
  ON ai_analysis_jobs (scan_id);
ALTER TABLE ai_analysis_jobs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_analysis_jobs' AND policyname='Service role access to ai_analysis_jobs') THEN
    CREATE POLICY "Service role access to ai_analysis_jobs" ON ai_analysis_jobs FOR ALL USING (true);
  END IF;
END $$;`
  },

  // ── Migration 004 ─────────────────────────────────────────────────────────────
  {
    label: 'Create claim_next_ai_job() function',
    sql: `
CREATE OR REPLACE FUNCTION claim_next_ai_job()
RETURNS SETOF ai_analysis_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE ai_analysis_jobs
  SET
    status     = 'running',
    started_at = NOW(),
    attempts   = attempts + 1
  WHERE id = (
    SELECT id
    FROM   ai_analysis_jobs
    WHERE  status       = 'pending'
      AND  scheduled_at <= NOW()
      AND  attempts     <  3
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
GRANT EXECUTE ON FUNCTION claim_next_ai_job() TO service_role;`
  },

  // ── Migration 005 ─────────────────────────────────────────────────────────────
  {
    label: 'Add fix_helpful to issues',
    sql: `ALTER TABLE issues ADD COLUMN IF NOT EXISTS fix_helpful BOOLEAN;`
  },
  {
    label: 'Add needs_refresh to issue_patterns',
    sql: `ALTER TABLE issue_patterns ADD COLUMN IF NOT EXISTS needs_refresh BOOLEAN NOT NULL DEFAULT false;`
  },
  {
    label: 'Create record_issue_feedback() function',
    sql: `
CREATE OR REPLACE FUNCTION record_issue_feedback(
  p_issue_id UUID,
  p_helpful  BOOLEAN
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE issues SET fix_helpful = p_helpful WHERE id = p_issue_id;
  IF NOT p_helpful THEN
    UPDATE issue_patterns
    SET needs_refresh = true
    WHERE id IN (
      SELECT pattern_id FROM issue_pattern_matches WHERE issue_id = p_issue_id
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION record_issue_feedback(UUID, BOOLEAN) TO service_role;`
  },

  // ── Migration 006 ─────────────────────────────────────────────────────────────
  {
    label: 'Rebuild issues_with_analysis view (add fix_helpful + needs_refresh)',
    sql: `
DROP VIEW IF EXISTS issues_with_analysis;
CREATE VIEW issues_with_analysis AS
SELECT
  i.id, i.scan_id, i.page_id, i.type, i.severity, i.title,
  i.description, i.details, i.fingerprint, i.framework,
  i.fix_helpful,
  i.created_at,
  ie.summary          AS ai_summary,
  ie.root_cause,
  ie.fix_suggestion,
  ie.confidence,
  ie.analysis_data,
  ie.model_version,
  ie.analysis_version,
  ie.from_pattern,
  ie.pattern_id,
  ie.analyzed_at,
  ip.occurrence_count     AS pattern_count,
  ip.affected_frameworks  AS pattern_frameworks,
  ip.total_scans_affected,
  ip.needs_refresh        AS pattern_needs_refresh
FROM issues i
LEFT JOIN issues_enriched ie ON ie.issue_id = i.id
LEFT JOIN issue_patterns  ip ON ip.id = ie.pattern_id;`
  },
  {
    label: 'Add feedback and refresh indexes (migration 006)',
    sql: `
CREATE INDEX IF NOT EXISTS idx_issues_fix_helpful
  ON issues (fix_helpful)
  WHERE fix_helpful IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_needs_refresh
  ON issue_patterns (id)
  WHERE needs_refresh = true;
CREATE INDEX IF NOT EXISTS idx_ie_model_version_asc
  ON issues_enriched (model_version, analyzed_at ASC)
  WHERE model_version IS NOT NULL;`
  },

  // ── Migration 008 ─────────────────────────────────────────────────────────────
  {
    label: 'Create pattern_clusters table',
    sql: `
CREATE TABLE IF NOT EXISTS pattern_clusters (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key       TEXT        NOT NULL UNIQUE,
  type              TEXT        NOT NULL,
  canonical_title   TEXT        NOT NULL,
  pattern_count     INTEGER     NOT NULL DEFAULT 1,
  representative_id UUID        REFERENCES issue_patterns(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pc_cluster_key  ON pattern_clusters (cluster_key);
CREATE INDEX IF NOT EXISTS idx_pc_type         ON pattern_clusters (type);
CREATE INDEX IF NOT EXISTS idx_pc_occurrences  ON pattern_clusters (pattern_count DESC);
ALTER TABLE pattern_clusters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pattern_clusters' AND policyname='Public access to pattern_clusters') THEN
    CREATE POLICY "Public access to pattern_clusters" ON pattern_clusters FOR ALL USING (true);
  END IF;
END $$;`
  },
  {
    label: 'Add cluster + feedback + velocity columns to issue_patterns',
    sql: `
ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS cluster_key       TEXT,
  ADD COLUMN IF NOT EXISTS cluster_id        UUID REFERENCES pattern_clusters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS feedback_positive INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback_negative INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trend_velocity    REAL;
CREATE INDEX IF NOT EXISTS idx_ip_cluster_key ON issue_patterns (cluster_key) WHERE cluster_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_cluster_id  ON issue_patterns (cluster_id)  WHERE cluster_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_trend_vel   ON issue_patterns (trend_velocity DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ip_feedback    ON issue_patterns (feedback_positive DESC, feedback_negative DESC);`
  },
  {
    label: 'Update record_issue_feedback() to track feedback counts',
    sql: `
CREATE OR REPLACE FUNCTION record_issue_feedback(
  p_issue_id UUID,
  p_helpful  BOOLEAN
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE issues SET fix_helpful = p_helpful WHERE id = p_issue_id;
  IF p_helpful THEN
    UPDATE issue_patterns
    SET feedback_positive = COALESCE(feedback_positive, 0) + 1
    WHERE id IN (
      SELECT pattern_id FROM issue_pattern_matches WHERE issue_id = p_issue_id
    );
  ELSE
    UPDATE issue_patterns
    SET
      feedback_negative = COALESCE(feedback_negative, 0) + 1,
      needs_refresh     = true
    WHERE id IN (
      SELECT pattern_id FROM issue_pattern_matches WHERE issue_id = p_issue_id
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION record_issue_feedback(UUID, BOOLEAN) TO service_role;`
  },
  {
    label: 'Create refresh_cluster_counts() function',
    sql: `
CREATE OR REPLACE FUNCTION refresh_cluster_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recompute pattern_count from the actual issue_patterns rows
  UPDATE pattern_clusters pc
  SET
    pattern_count     = sub.cnt,
    representative_id = sub.rep_id,
    updated_at        = NOW()
  FROM (
    SELECT
      cluster_id,
      COUNT(*)                                                  AS cnt,
      (ARRAY_AGG(id ORDER BY occurrence_count DESC NULLS LAST))[1] AS rep_id
    FROM issue_patterns
    WHERE cluster_id IS NOT NULL
    GROUP BY cluster_id
  ) sub
  WHERE pc.id = sub.cluster_id;
END;
$$;
GRANT EXECUTE ON FUNCTION refresh_cluster_counts() TO service_role;`
  },
  {
    label: 'Create refresh_pattern_velocities() function',
    sql: `
CREATE OR REPLACE FUNCTION refresh_pattern_velocities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set velocity = occurrences-in-7-days / 7 for active patterns
  UPDATE issue_patterns ip
  SET trend_velocity = sub.velocity
  FROM (
    SELECT pattern_id, COUNT(*)::REAL / 7.0 AS velocity
    FROM   pattern_occurrences
    WHERE  occurred_at >= NOW() - INTERVAL '7 days'
    GROUP  BY pattern_id
  ) sub
  WHERE ip.id = sub.pattern_id;

  -- Zero out patterns not seen in last 7 days
  UPDATE issue_patterns
  SET trend_velocity = 0
  WHERE (trend_velocity IS NULL OR trend_velocity > 0)
    AND id NOT IN (
      SELECT DISTINCT pattern_id
      FROM   pattern_occurrences
      WHERE  occurred_at >= NOW() - INTERVAL '7 days'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION refresh_pattern_velocities() TO service_role;`
  },
  {
    label: 'Rebuild issues_with_analysis view (add feedback + cluster columns)',
    sql: `
DROP VIEW IF EXISTS issues_with_analysis;
CREATE VIEW issues_with_analysis AS
SELECT
  i.id, i.scan_id, i.page_id, i.type, i.severity, i.title,
  i.description, i.details, i.fingerprint, i.framework,
  i.fix_helpful,
  i.created_at,
  ie.summary          AS ai_summary,
  ie.root_cause,
  ie.fix_suggestion,
  ie.confidence,
  ie.analysis_data,
  ie.model_version,
  ie.analysis_version,
  ie.from_pattern,
  ie.pattern_id,
  ie.analyzed_at,
  ip.occurrence_count              AS pattern_count,
  ip.affected_frameworks           AS pattern_frameworks,
  ip.total_scans_affected,
  ip.needs_refresh                 AS pattern_needs_refresh,
  ip.feedback_positive             AS pattern_feedback_positive,
  ip.feedback_negative             AS pattern_feedback_negative,
  ip.cluster_key,
  ip.cluster_id
FROM issues i
LEFT JOIN issues_enriched ie ON ie.issue_id = i.id
LEFT JOIN issue_patterns  ip ON ip.id = ie.pattern_id;`
  },
  {
    label: 'Backfill cluster_key on existing issue_patterns',
    sql: `
UPDATE issue_patterns SET cluster_key = type WHERE cluster_key IS NULL;`
  },

  // ── Migration 007 ─────────────────────────────────────────────────────────────
  {
    label: 'Add rate-limit index on scans(ip, created_at)',
    sql: `
CREATE INDEX IF NOT EXISTS idx_scans_ip_created_at
  ON scans (ip, created_at DESC)
  WHERE ip IS NOT NULL;`
  },
  {
    label: 'Add issues sort index (scan_id, severity, created_at)',
    sql: `
CREATE INDEX IF NOT EXISTS idx_issues_scan_sort
  ON issues (scan_id, severity, created_at);`
  },
  {
    label: 'Add partial indexes on scanned_pages boolean flags',
    sql: `
CREATE INDEX IF NOT EXISTS idx_scanned_pages_errors
  ON scanned_pages (scan_id)
  WHERE has_console_errors = true;
CREATE INDEX IF NOT EXISTS idx_scanned_pages_network
  ON scanned_pages (scan_id)
  WHERE has_network_failures = true;
CREATE INDEX IF NOT EXISTS idx_scanned_pages_mobile
  ON scanned_pages (scan_id)
  WHERE has_mobile_issues = true;`
  },
  {
    label: 'Add pattern refresh queue index',
    sql: `
CREATE INDEX IF NOT EXISTS idx_ip_refresh_queue
  ON issue_patterns (last_seen_at DESC)
  WHERE needs_refresh = true;`
  },
  {
    label: 'Add GIN index on scanned_pages.network_details',
    sql: `
CREATE INDEX IF NOT EXISTS idx_scanned_pages_network_gin
  ON scanned_pages USING GIN (network_details)
  WHERE network_details IS NOT NULL;`
  },
  {
    label: 'Add analytics indexes (completed scans, issue type+severity)',
    sql: `
CREATE INDEX IF NOT EXISTS idx_scans_completed_at
  ON scans (completed_at DESC)
  WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_issues_type_severity
  ON issues (type, severity);`
  },
]

// ── Pooler auto-discovery ─────────────────────────────────────────────────────

// When the direct URL fails (IPv6-only on many ISPs), try Supabase session
// poolers in common regions. Returns the first URL that connects, or null.
async function tryPoolerRegions(projectRef, password) {
  const regions = [
    'ap-south-1',      // Mumbai — likely for India-based users
    'ap-southeast-1',  // Singapore
    'us-east-1',
    'eu-central-1',
    'ap-northeast-1',  // Tokyo
    'us-west-1',
    'eu-west-2',
    'sa-east-1',
    'ca-central-1',
  ]
  const user = `postgres.${projectRef}`
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`
    const url  = `postgresql://${user}:${encodeURIComponent(password)}@${host}:5432/postgres`
    const probe = new Client({ connectionString: url, ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000 })
    try {
      await probe.connect()
      await probe.end()
      return { url, host }
    } catch {
      // try next region
    }
  }
  return null
}

// Extract password from a postgresql:// URI
function extractPassword(url) {
  try {
    const m = url.match(/^postgresql?:\/\/[^:]+:([^@]+)@/)
    return m ? decodeURIComponent(m[1]) : null
  } catch { return null }
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function runSteps(client) {
  let passed = 0
  let failed = 0

  for (const step of steps) {
    process.stdout.write(`   ${step.label}... `)
    try {
      await client.query(step.sql.trim())
      console.log('OK')
      passed++
    } catch (err) {
      const msg = err.message || String(err)
      if (/already exists/i.test(msg)) {
        console.log('OK (already exists)')
        passed++
      } else {
        console.log(`FAILED — ${msg}`)
        failed++
      }
    }
  }

  await client.end()
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`   ${passed} passed    ${failed} failed`)
  if (failed === 0) {
    console.log(`\n   Migration complete! Your database is ready.\n`)
  } else {
    console.log(`\n   Some steps failed. Check the errors above.\n`)
    process.exit(1)
  }
}

// ── Management API path (HTTPS — works on any network) ────────────────────────

async function runViaManagementAPI() {
  const apiBase = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type':  'application/json',
  }

  async function execSQL(sql) {
    const res  = await fetch(apiBase, { method: 'POST', headers, body: JSON.stringify({ query: sql.trim() }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = body?.message ?? body?.error ?? `HTTP ${res.status}`
      throw new Error(msg)
    }
  }

  let passed = 0
  let failed = 0

  for (const step of steps) {
    process.stdout.write(`   ${step.label}... `)
    try {
      await execSQL(step.sql)
      console.log('OK')
      passed++
    } catch (err) {
      const msg = err.message || String(err)
      if (/already exists/i.test(msg)) {
        console.log('OK (already exists)')
        passed++
      } else {
        console.log(`FAILED — ${msg}`)
        failed++
      }
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`   ${passed} passed    ${failed} failed`)
  if (failed === 0) {
    console.log(`\n   Migration complete! Your database is ready.\n`)
  } else {
    console.log(`\n   Some steps failed. Check the errors above.\n`)
    process.exit(1)
  }
}

// ── Postgres path ─────────────────────────────────────────────────────────────

async function runMigration() {
  console.log(`\n  AgentQA — database migration`)
  console.log(`   Steps: ${steps.length}\n`)

  // Prefer Management API — works from any network over HTTPS
  if (ACCESS_TOKEN) {
    console.log(`   Mode:  Supabase Management API (HTTPS)\n`)
    return runViaManagementAPI()
  }

  if (!DB_URL) {
    console.error('  No connection configured. Add to .env.local:')
    console.error('  SUPABASE_ACCESS_TOKEN=<PAT from supabase.com/dashboard/account/tokens>\n')
    process.exit(1)
  }

  console.log(`   Host:  ${DB_HOST}\n`)

  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    return runSteps(client)
  } catch (err) {
    const isDnsFailure = /ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)
    // Auto-discover the session pooler when the current URL is a direct URL
    if (isDnsFailure && isDirectUrl(DB_URL)) {
      console.log('   Direct URL failed (IPv6-only) — probing session pooler regions...\n')
      const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0]
      const password   = extractPassword(DB_URL) ?? DB_PASSWORD
      if (projectRef && password) {
        const found = await tryPoolerRegions(projectRef, password)
        if (found) {
          console.log(`   Connected via: ${found.host}`)
          console.log(`   Save this to .env.local to skip probing next time:`)
          console.log(`   SUPABASE_POOLER_URL=${found.url}\n`)
          const poolerClient = new Client({ connectionString: found.url, ssl: { rejectUnauthorized: false } })
          await poolerClient.connect()
          return runSteps(poolerClient)
        }
      }
    }
    console.error(`\n  Could not connect: ${err.message}`)
    console.error('  Set SUPABASE_POOLER_URL in .env.local (Session mode URI from Supabase dashboard)\n')
    process.exit(1)
  }
}

runMigration().catch((err) => {
  console.error('\n  Unexpected error:', err.message)
  process.exit(1)
})
