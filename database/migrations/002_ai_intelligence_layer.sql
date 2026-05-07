-- ============================================================
-- Migration 002 — AI Intelligence Layer
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New Query)
--
-- Adds:
--   issues_enriched      — AI analysis document per issue (JSONB)
--   issue_patterns       — extended columns for learning + frequency tracking
--   pattern_occurrences  — time-series occurrence log (pattern × scan)
--   issues_with_analysis — convenience read view
--
-- Safe to run on an existing database with Phase 1/2 data.
-- All statements use IF NOT EXISTS / IF EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ============================================================
-- 0. PREREQUISITES
-- ============================================================

-- pgcrypto already enabled in 001 (schema.sql), but guard anyway
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. issues_enriched
--
-- Authoritative store for AI analysis output — separate from
-- the raw detection data in `issues`.
--
-- Separation rationale:
--   • The scan pipeline writes to `issues` in the hot path.
--   • AI enrichment runs asynchronously after the scan completes.
--   • Keeping enrichment data out of `issues` means the fast
--     write path is never blocked by AI latency.
--   • JSONB `analysis_data` can grow over time without schema
--     changes — new fields are just JSONB keys.
--
-- One row per issue (UNIQUE on issue_id).
-- ============================================================

CREATE TABLE IF NOT EXISTS issues_enriched (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id         UUID        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,

  -- ── Core analysis output ───────────────────────────────────
  -- Denormalised from analysis_data for fast single-column reads
  -- (avoids JSONB extraction on every report query).
  summary          TEXT        NOT NULL,
  root_cause       TEXT        NOT NULL,
  fix_suggestion   TEXT        NOT NULL,

  -- ── Quality signal ─────────────────────────────────────────
  -- 0.0 = uncertain / from coarse fallback
  -- 1.0 = high-confidence / model confirmed
  -- NULL = not yet scored
  confidence       REAL        CHECK (confidence >= 0.0 AND confidence <= 1.0),

  -- ── Extended JSONB analysis document ───────────────────────
  -- Schema (all keys optional, grows without migrations):
  --   fix_complexity     : "trivial" | "low" | "medium" | "high"
  --   estimated_fix_time : "5min" | "30min" | "2h" | "1day"
  --   code_hints         : string[]   -- relevant code patterns or snippets
  --   docs_refs          : string[]   -- relevant docs/MDN/RFC URLs
  --   tags               : string[]   -- categorisation: ["auth","react","mobile"]
  --   related_types      : string[]   -- issue types that commonly co-occur
  --   reproduction_steps : string     -- how to reproduce
  --   error_class        : string     -- extracted error class ("TypeError")
  analysis_data    JSONB       NOT NULL DEFAULT '{}',

  -- ── Provenance ─────────────────────────────────────────────
  model_version    TEXT        NOT NULL,
  -- Incremented each time this issue is re-analyzed (e.g. after
  -- a model upgrade or when from_pattern = true and template changes).
  analysis_version INTEGER     NOT NULL DEFAULT 1,
  -- TRUE when the analysis was satisfied from a cached pattern
  -- template — no Claude call was made.
  from_pattern     BOOLEAN     NOT NULL DEFAULT false,
  -- FK populated when from_pattern = true.
  pattern_id       UUID        REFERENCES issue_patterns(id) ON DELETE SET NULL,

  -- ── Timestamps ─────────────────────────────────────────────
  analyzed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (issue_id)
);

-- ── Indexes on issues_enriched ───────────────────────────────

-- Point lookup: GET /api/scan/:id joins issues → issues_enriched
CREATE INDEX IF NOT EXISTS idx_ie_issue_id
  ON issues_enriched (issue_id);

-- "Which issues came from this pattern?" (pattern detail page)
CREATE INDEX IF NOT EXISTS idx_ie_pattern_id
  ON issues_enriched (pattern_id)
  WHERE pattern_id IS NOT NULL;

-- Recency queries: "show me issues analyzed in the last 24 h"
-- and for pagination through the enrichment backlog
CREATE INDEX IF NOT EXISTS idx_ie_analyzed_at
  ON issues_enriched (analyzed_at DESC);

-- Model-version filter: re-analyze issues from an old model version
CREATE INDEX IF NOT EXISTS idx_ie_model_version
  ON issues_enriched (model_version)
  WHERE model_version IS NOT NULL;

-- Low-confidence filter: flag issues that need a second opinion
-- Partial index keeps the index small — only rows with a score
CREATE INDEX IF NOT EXISTS idx_ie_confidence
  ON issues_enriched (confidence)
  WHERE confidence IS NOT NULL;

-- JSONB path queries on analysis_data:
--   SELECT * FROM issues_enriched WHERE analysis_data @> '{"fix_complexity":"high"}'
--   SELECT * FROM issues_enriched WHERE analysis_data ? 'code_hints'
--   jsonb_ops (default) supports @>, ?, ?|, ?&
CREATE INDEX IF NOT EXISTS idx_ie_analysis_data_gin
  ON issues_enriched USING GIN (analysis_data);

-- Composite: version-filtered recency (re-analysis campaigns)
--   WHERE model_version != 'claude-haiku-4-5-20251001' ORDER BY analyzed_at DESC
CREATE INDEX IF NOT EXISTS idx_ie_model_analyzed
  ON issues_enriched (model_version, analyzed_at DESC);

-- ── Row level security ────────────────────────────────────────

ALTER TABLE issues_enriched ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to issues_enriched"
  ON issues_enriched FOR ALL USING (true);

-- ── Trigger: keep updated_at current ─────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_issues_enriched_updated_at ON issues_enriched;
CREATE TRIGGER trg_issues_enriched_updated_at
  BEFORE UPDATE ON issues_enriched
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ============================================================
-- 2. issue_patterns — extended columns
--
-- Existing columns (from schema.sql):
--   fingerprint, type, severity, title,
--   occurrence_count, affected_frameworks TEXT[],
--   root_cause_template, fix_template,
--   first_seen_at, last_seen_at
--
-- New columns added below expand the learning capabilities
-- without breaking the existing pattern-matcher service.
-- ============================================================

-- Average confidence across all enriched issues that matched
-- this pattern. Updated by the AI analyzer after each new match.
ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS confidence_score REAL
  CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0);

-- Incremented each time root_cause_template or fix_template
-- is updated. Consumers can detect stale cached data.
ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS template_version INTEGER NOT NULL DEFAULT 1;

-- When the template was last written (helps schedule refresh jobs)
ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS template_updated_at TIMESTAMPTZ;

-- Which model version last wrote the template — used to detect
-- templates that pre-date a model upgrade and need re-analysis.
ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS last_model_version TEXT;

-- Count of distinct scans (not issues) that triggered this pattern.
-- occurrence_count tracks issues; this tracks unique deployments.
ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS total_scans_affected INTEGER NOT NULL DEFAULT 0;

-- A representative raw error text stored verbatim. Useful as
-- few-shot context when re-generating the template with a new model.
ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS example_raw TEXT;

-- Flexible JSONB metadata document. Schema (all keys optional):
--   fix_complexity   : "trivial" | "low" | "medium" | "high"
--   category         : string      -- "authentication" | "layout" | "performance" …
--   tags             : string[]
--   needs_refresh    : boolean     -- set true to queue a template re-generation
--   framework_counts : { [framework: string]: number }  -- per-framework tally
--   avg_fix_time     : string      -- running estimate
--   template_quality : "low" | "medium" | "high"  -- manually or auto-validated
ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- ── New indexes on issue_patterns ────────────────────────────

-- Array containment: "find patterns affecting next.js"
--   WHERE affected_frameworks @> ARRAY['next.js']
-- Also supports && (overlap) and <@ (contained by)
CREATE INDEX IF NOT EXISTS idx_ip_frameworks_gin
  ON issue_patterns USING GIN (affected_frameworks);

-- JSONB queries on metadata
--   WHERE metadata @> '{"needs_refresh": true}'
--   WHERE metadata @> '{"category": "authentication"}'
CREATE INDEX IF NOT EXISTS idx_ip_metadata_gin
  ON issue_patterns USING GIN (metadata);

-- Most-impactful patterns (admin dashboards, priority queues)
CREATE INDEX IF NOT EXISTS idx_ip_total_scans_affected
  ON issue_patterns (total_scans_affected DESC);

-- High-confidence patterns for template promotion
CREATE INDEX IF NOT EXISTS idx_ip_confidence_score
  ON issue_patterns (confidence_score DESC)
  WHERE confidence_score IS NOT NULL;

-- Stale template detection: ORDER BY template_updated_at ASC
CREATE INDEX IF NOT EXISTS idx_ip_template_updated_at
  ON issue_patterns (template_updated_at ASC)
  WHERE template_updated_at IS NOT NULL;

-- ============================================================
-- 3. pattern_occurrences — time-series frequency log
--
-- One row per (pattern × scan) occurrence. Allows queries like:
--   "How many times was this pattern seen in the last 7 days?"
--   "Which frameworks most commonly trigger this pattern?"
--   "Is the occurrence rate trending up or down?"
--
-- Granularity is per-scan (not per-issue) so a scan with 5 JS
-- errors of the same type counts as 1 occurrence, not 5.
-- ============================================================

CREATE TABLE IF NOT EXISTS pattern_occurrences (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id  UUID        NOT NULL REFERENCES issue_patterns(id) ON DELETE CASCADE,
  scan_id     UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,

  -- Primary framework detected for this scan — NULL if none detected.
  -- Denormalised here to avoid joining scan_frameworks on every
  -- time-series query (read-optimised).
  framework   TEXT,

  -- Wall-clock timestamp of the occurrence (≈ scan completed_at).
  -- Indexed separately from (pattern_id, …) to allow cross-pattern
  -- time-range scans.
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One occurrence record per pattern per scan
  UNIQUE (pattern_id, scan_id)
);

-- ── Indexes on pattern_occurrences ───────────────────────────

-- Core time-series query: pattern frequency over time
--   WHERE pattern_id = ? ORDER BY occurred_at DESC
CREATE INDEX IF NOT EXISTS idx_po_pattern_time
  ON pattern_occurrences (pattern_id, occurred_at DESC);

-- Scan lookup: "which patterns fired during this scan?"
CREATE INDEX IF NOT EXISTS idx_po_scan_id
  ON pattern_occurrences (scan_id);

-- Framework frequency: "which patterns most affect react apps this week?"
--   WHERE framework = 'react' AND occurred_at > NOW() - INTERVAL '7 days'
CREATE INDEX IF NOT EXISTS idx_po_framework_time
  ON pattern_occurrences (framework, occurred_at DESC)
  WHERE framework IS NOT NULL;

-- Global recency: most recent occurrences across all patterns
CREATE INDEX IF NOT EXISTS idx_po_occurred_at
  ON pattern_occurrences (occurred_at DESC);

-- ── Row level security ────────────────────────────────────────

ALTER TABLE pattern_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to pattern_occurrences"
  ON pattern_occurrences FOR ALL USING (true);

-- ============================================================
-- 4. Convenience view: issues_with_analysis
--
-- Replaces the manual JOIN in app/api/scan/[id]/route.ts.
-- Returns all issue columns plus enrichment data where available.
-- NULL enrichment columns = issue not yet analyzed.
-- ============================================================

CREATE OR REPLACE VIEW issues_with_analysis AS
SELECT
  -- All raw issue fields
  i.id,
  i.scan_id,
  i.page_id,
  i.type,
  i.severity,
  i.title,
  i.description,
  i.details,
  i.fingerprint,
  i.framework,
  i.created_at,

  -- Enrichment (NULL when not yet analyzed)
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

  -- Pattern cross-scan data (NULL when not matched to a pattern)
  ip.occurrence_count AS pattern_count,
  ip.affected_frameworks AS pattern_frameworks,
  ip.total_scans_affected
FROM issues i
LEFT JOIN issues_enriched ie ON ie.issue_id = i.id
LEFT JOIN issue_patterns  ip ON ip.id = ie.pattern_id;

COMMENT ON VIEW issues_with_analysis IS
  'Joins issues + issues_enriched + issue_patterns. '
  'Enrichment columns are NULL for issues not yet analyzed.';

-- ============================================================
-- 5. Data migration
--
-- Back-fills issues_enriched from the flat text columns
-- that the Phase 2 AI analyzer wrote to issues.ai_summary etc.
--
-- This is a one-time migration — the service layer should be
-- updated to write to issues_enriched going forward.
--
-- Skips rows that already exist in issues_enriched (ON CONFLICT DO NOTHING).
-- Skips issues with no ai_summary (not yet analyzed).
-- ============================================================

INSERT INTO issues_enriched (
  issue_id,
  summary,
  root_cause,
  fix_suggestion,
  confidence,
  analysis_data,
  model_version,
  analysis_version,
  from_pattern,
  pattern_id,
  analyzed_at
)
SELECT
  i.id                              AS issue_id,
  i.ai_summary                      AS summary,
  COALESCE(i.root_cause, '')        AS root_cause,
  COALESCE(i.fix_suggestion, '')    AS fix_suggestion,
  NULL                              AS confidence,   -- unknown at migration time
  '{}'::JSONB                       AS analysis_data,
  'claude-haiku-4-5-20251001'       AS model_version, -- assumed; was not recorded
  1                                 AS analysis_version,
  -- from_pattern: true when issue was linked to a pattern AND
  -- the pattern had a cached template (pattern_id not null below)
  (ipm.pattern_id IS NOT NULL)      AS from_pattern,
  ipm.pattern_id,
  i.created_at                      AS analyzed_at  -- best approximation
FROM issues i
LEFT JOIN issue_pattern_matches ipm ON ipm.issue_id = i.id
WHERE i.ai_summary IS NOT NULL
ON CONFLICT (issue_id) DO NOTHING;

-- Back-fill pattern_occurrences from existing issue_pattern_matches.
-- Groups by (pattern_id, scan_id) — one row per pair, using
-- min(created_at) of matched issues as the occurrence timestamp.
INSERT INTO pattern_occurrences (pattern_id, scan_id, framework, occurred_at)
SELECT
  ipm.pattern_id,
  i.scan_id,
  -- Primary framework for the scan (highest confidence)
  (
    SELECT sf.framework
    FROM scan_frameworks sf
    WHERE sf.scan_id = i.scan_id
    ORDER BY sf.confidence DESC
    LIMIT 1
  ),
  MIN(ipm.created_at) AS occurred_at
FROM issue_pattern_matches ipm
JOIN issues i ON i.id = ipm.issue_id
GROUP BY ipm.pattern_id, i.scan_id
ON CONFLICT (pattern_id, scan_id) DO NOTHING;

-- ============================================================
-- 6. Helpful analytics queries (run manually as needed)
-- ============================================================

-- Top 10 patterns by scan frequency this month:
-- SELECT ip.fingerprint, ip.type, ip.title,
--        COUNT(*) AS occurrences_this_month
-- FROM pattern_occurrences po
-- JOIN issue_patterns ip ON ip.id = po.pattern_id
-- WHERE po.occurred_at >= date_trunc('month', NOW())
-- GROUP BY ip.id, ip.fingerprint, ip.type, ip.title
-- ORDER BY occurrences_this_month DESC
-- LIMIT 10;

-- Patterns that need template refresh (old model or never templated):
-- SELECT ip.fingerprint, ip.type, ip.occurrence_count,
--        ip.last_model_version, ip.template_updated_at
-- FROM issue_patterns ip
-- WHERE (ip.metadata->>'needs_refresh')::boolean = true
--    OR ip.last_model_version IS NULL
--    OR ip.last_model_version != 'claude-haiku-4-5-20251001'
-- ORDER BY ip.occurrence_count DESC;

-- Low-confidence issues that should be re-analyzed:
-- SELECT i.id, i.type, i.title, ie.confidence, ie.model_version
-- FROM issues_enriched ie
-- JOIN issues i ON i.id = ie.issue_id
-- WHERE ie.confidence < 0.6 OR ie.confidence IS NULL
-- ORDER BY ie.analyzed_at DESC
-- LIMIT 50;

-- Framework frequency breakdown for a specific pattern:
-- SELECT framework, COUNT(*) AS hits
-- FROM pattern_occurrences
-- WHERE pattern_id = '<uuid>'
-- GROUP BY framework
-- ORDER BY hits DESC;
