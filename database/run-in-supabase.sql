CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────

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
-- Add columns that may be missing if scans table already existed
ALTER TABLE scans ADD COLUMN IF NOT EXISTS score         INTEGER CHECK (score >= 0 AND score <= 100);
ALTER TABLE scans ADD COLUMN IF NOT EXISTS total_pages   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS total_issues  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS notify_email  TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS ip            TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS ai_overview   TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS started_at    TIMESTAMPTZ;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_scans_status     ON scans (status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_url_status ON scans (url, status, created_at DESC);

-- ─────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_scanned_pages_scan_id ON scanned_pages (scan_id);

-- ─────────────────────────────────────────────

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
-- Add columns that may be missing if the table already existed
ALTER TABLE issues ADD COLUMN IF NOT EXISTS ai_summary     TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS root_cause     TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS fix_suggestion TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS fingerprint    TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS framework      TEXT;
CREATE INDEX IF NOT EXISTS idx_issues_scan_id     ON issues (scan_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity    ON issues (severity);
CREATE INDEX IF NOT EXISTS idx_issues_page_id     ON issues (page_id);
CREATE INDEX IF NOT EXISTS idx_issues_fingerprint ON issues (fingerprint) WHERE fingerprint IS NOT NULL;

-- ─────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_page_logs_level   ON page_logs (level);

-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scan_logs (
  id         BIGSERIAL   PRIMARY KEY,
  scan_id    UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scan_id ON scan_logs (scan_id);

-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL UNIQUE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_email      ON waitlist (email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist (created_at DESC);

-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scan_frameworks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id    UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  framework  TEXT        NOT NULL,
  confidence REAL        NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  signals    TEXT[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scan_frameworks_scan_id ON scan_frameworks (scan_id);

-- ─────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_ip_metadata_gin     ON issue_patterns USING GIN (metadata);

-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS issue_pattern_matches (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id   UUID        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  pattern_id UUID        NOT NULL REFERENCES issue_patterns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (issue_id, pattern_id)
);
CREATE INDEX IF NOT EXISTS idx_ipm_issue_id   ON issue_pattern_matches (issue_id);
CREATE INDEX IF NOT EXISTS idx_ipm_pattern_id ON issue_pattern_matches (pattern_id);

-- ─────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_ie_analysis_gin   ON issues_enriched USING GIN (analysis_data);

-- ─────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_po_framework    ON pattern_occurrences (framework, occurred_at DESC) WHERE framework IS NOT NULL;

-- ─────────────────────────────────────────────

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
ALTER TABLE pattern_occurrences   ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────

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
END $$;

-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_issues_enriched_updated_at ON issues_enriched;
CREATE TRIGGER trg_issues_enriched_updated_at
  BEFORE UPDATE ON issues_enriched
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─────────────────────────────────────────────

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
LEFT JOIN issue_patterns  ip ON ip.id = ie.pattern_id;

-- ─────────────────────────────────────────────

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
ON CONFLICT (issue_id) DO NOTHING;

-- ─────────────────────────────────────────────

INSERT INTO pattern_occurrences (pattern_id, scan_id, framework, occurred_at)
SELECT
  ipm.pattern_id, i.scan_id,
  (SELECT sf.framework FROM scan_frameworks sf
   WHERE sf.scan_id = i.scan_id ORDER BY sf.confidence DESC LIMIT 1),
  MIN(ipm.created_at)
FROM issue_pattern_matches ipm
JOIN issues i ON i.id = ipm.issue_id
GROUP BY ipm.pattern_id, i.scan_id
ON CONFLICT (pattern_id, scan_id) DO NOTHING;