-- ============================================================
-- Migration 006 — Rebuild issues_with_analysis view + feedback/refresh indexes
-- Prerequisites: 002 (issues_enriched), 005 (fix_helpful, needs_refresh)
--
-- 005 added fix_helpful to issues and needs_refresh to issue_patterns,
-- but the view defined in 002 predates those columns. This migration
-- rebuilds the view to expose both, and adds targeted partial indexes
-- to serve the feedback analytics and pattern refresh queue queries.
-- ============================================================

-- ── 1. Rebuild view to include fix_helpful + needs_refresh ────────────────────

DROP VIEW IF EXISTS issues_with_analysis;
CREATE VIEW issues_with_analysis AS
SELECT
  -- Raw issue fields
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
  i.fix_helpful,                        -- feedback signal (added in 005)
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

  -- Cross-scan pattern data (NULL when not matched to a pattern)
  ip.occurrence_count     AS pattern_count,
  ip.affected_frameworks  AS pattern_frameworks,
  ip.total_scans_affected,
  ip.needs_refresh        AS pattern_needs_refresh   -- refresh flag (added in 005)
FROM issues i
LEFT JOIN issues_enriched ie ON ie.issue_id = i.id
LEFT JOIN issue_patterns  ip ON ip.id = ie.pattern_id;

COMMENT ON VIEW issues_with_analysis IS
  'Joins issues + issues_enriched + issue_patterns. '
  'Enrichment columns are NULL for issues not yet analyzed. '
  'Updated in 006 to include fix_helpful and pattern_needs_refresh.';

-- ── 2. Feedback analytics indexes ────────────────────────────────────────────

-- Fast aggregate: "what % of issues have been rated helpful?"
-- Partial index only covers rows with a rating — keeps it small.
CREATE INDEX IF NOT EXISTS idx_issues_fix_helpful
  ON issues (fix_helpful)
  WHERE fix_helpful IS NOT NULL;

-- ── 3. Pattern refresh queue index ───────────────────────────────────────────

-- Fast scan for patterns flagged for re-analysis.
-- Partial index only covers rows that need refreshing.
CREATE INDEX IF NOT EXISTS idx_ip_needs_refresh
  ON issue_patterns (id)
  WHERE needs_refresh = true;

-- ── 4. issues_enriched: model version upgrade campaigns ──────────────────────

-- Composite index for: "find all enriched issues from model X, oldest first"
-- Used to re-analyze legacy data after a model upgrade.
-- (Supplements idx_ie_model_analyzed from 002 which orders by DESC.)
CREATE INDEX IF NOT EXISTS idx_ie_model_version_asc
  ON issues_enriched (model_version, analyzed_at ASC)
  WHERE model_version IS NOT NULL;
