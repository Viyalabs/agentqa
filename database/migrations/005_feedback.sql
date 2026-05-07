-- ============================================================
-- Migration 005 — Feedback loop + regression detection
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- Track per-issue user feedback on AI fix suggestions
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS fix_helpful BOOLEAN;

-- Flag patterns whose templates should be refreshed on next analysis
-- (set to true when a user marks the fix as unhelpful)
ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS needs_refresh BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────

-- Atomically record a helpfulness vote for one issue.
-- If the vote is negative, marks the linked pattern for refresh.
CREATE OR REPLACE FUNCTION record_issue_feedback(
  p_issue_id UUID,
  p_helpful  BOOLEAN
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE issues
  SET fix_helpful = p_helpful
  WHERE id = p_issue_id;

  IF NOT p_helpful THEN
    UPDATE issue_patterns
    SET needs_refresh = true
    WHERE id IN (
      SELECT pattern_id
      FROM   issue_pattern_matches
      WHERE  issue_id = p_issue_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION record_issue_feedback(UUID, BOOLEAN) TO service_role;
