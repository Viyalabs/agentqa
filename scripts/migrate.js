#!/usr/bin/env node
/**
 * AgentQA — Supabase migration runner
 * Usage: node scripts/migrate.js
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
 * and applies the full schema via the Supabase REST API.
 */

const fs   = require('fs')
const path = require('path')
const https = require('https')

// ── Load .env.local ───────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('\n❌  .env.local not found.')
    console.error('   Copy .env.example → .env.local and fill in your Supabase credentials.\n')
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

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || SUPABASE_URL.includes('your-project')) {
  console.error('\n❌  NEXT_PUBLIC_SUPABASE_URL is not set in .env.local\n')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes('your-service')) {
  console.error('\n❌  SUPABASE_SERVICE_ROLE_KEY is not set in .env.local\n')
  process.exit(1)
}

// ── SQL statements ────────────────────────────────────────────────────────────
// Each entry is a { label, sql } object run in order.
// Splitting into discrete statements gives clear per-step feedback.

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
    label: 'Enable Row Level Security',
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
]

// ── HTTP helper (no extra deps — uses built-in https) ─────────────────────────

function post(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const data   = JSON.stringify(body)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   'POST',
        headers:  { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }) }
          catch { resolve({ status: res.statusCode, body: raw }) }
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function runMigration() {
  const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0]
  const apiUrl     = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

  console.log(`\n🚀  AgentQA — Supabase migration`)
  console.log(`   Project: ${projectRef}`)
  console.log(`   Steps:   ${steps.length}\n`)

  let passed = 0
  let failed = 0

  for (const step of steps) {
    process.stdout.write(`   ${step.label}… `)
    try {
      const res = await post(
        apiUrl,
        { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
        { query: step.sql.trim() }
      )

      if (res.status >= 200 && res.status < 300) {
        console.log('✅')
        passed++
      } else {
        const msg = res.body?.message || res.body?.error || JSON.stringify(res.body)
        // "already exists" errors are expected on re-runs — treat as OK
        if (/already exists/i.test(msg)) {
          console.log('✅  (already exists)')
          passed++
        } else {
          console.log(`❌  ${msg}`)
          failed++
        }
      }
    } catch (err) {
      console.log(`❌  ${err.message}`)
      failed++
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`   ✅  ${passed} passed    ❌  ${failed} failed`)

  if (failed === 0) {
    console.log(`\n   🎉  Migration complete! Your database is ready.\n`)
  } else {
    console.log(`\n   ⚠️   Some steps failed. Check the errors above.\n`)
    process.exit(1)
  }
}

runMigration().catch((err) => {
  console.error('\n❌  Unexpected error:', err.message)
  process.exit(1)
})
