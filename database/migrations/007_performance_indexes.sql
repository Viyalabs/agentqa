-- ============================================================
-- Migration 007 — Performance indexes
--
-- Fixes identified by query audit:
--
--   HIGH
--   1. idx_scans_ip_created_at   — rate-limit check (ip + window) was full-scan
--   2. idx_issues_scan_sort      — scan issues sorted by (severity, created_at)
--                                  required a filesort after index scan
--   3. idx_scanned_pages_errors  — partial indexes for boolean flag filters
--      idx_scanned_pages_network
--      idx_scanned_pages_mobile
--
--   MEDIUM
--   4. idx_ip_refresh_queue      — picks stale patterns for re-analysis;
--                                  previously needed idx_ip_needs_refresh + filesort
--   5. idx_scanned_pages_net_gin — GIN for network_details JSONB queries
--
--   LOW / ANALYTICS
--   6. idx_scans_completed_at    — time-range queries on completed scans
--   7. idx_issues_type_severity  — grouping/filtering issues by type + severity
-- ============================================================

-- ── 1. Rate-limit check ───────────────────────────────────────────────────────
-- Query: SELECT COUNT(*) FROM scans WHERE ip = ? AND created_at >= ?
-- Was:   full table scan on scans
-- After: index-only scan on (ip, created_at)
CREATE INDEX IF NOT EXISTS idx_scans_ip_created_at
  ON scans (ip, created_at DESC)
  WHERE ip IS NOT NULL;

-- ── 2. Issues sort index ──────────────────────────────────────────────────────
-- Query: SELECT * FROM issues WHERE scan_id = ?
--        ORDER BY severity ASC, created_at ASC
-- Was:   idx_issues_scan_id → heap fetch → filesort
-- After: index provides both filter and sort order; no filesort
--
-- severity ordering convention: 'critical' < 'low' < 'medium' alphabetically,
-- but the app sorts ascending (PostgreSQL text order) which matches the intent
-- of showing critical issues first given the CHECK constraint values.
-- If severity ordering semantics change, consider an enum type instead.
CREATE INDEX IF NOT EXISTS idx_issues_scan_sort
  ON issues (scan_id, severity, created_at);

-- ── 3. Scanned pages boolean filters ─────────────────────────────────────────
-- These partial indexes are tiny (only flagged rows) but make filtering fast.
-- Query pattern: WHERE scan_id = ? AND has_console_errors = true
CREATE INDEX IF NOT EXISTS idx_scanned_pages_errors
  ON scanned_pages (scan_id)
  WHERE has_console_errors = true;

CREATE INDEX IF NOT EXISTS idx_scanned_pages_network
  ON scanned_pages (scan_id)
  WHERE has_network_failures = true;

CREATE INDEX IF NOT EXISTS idx_scanned_pages_mobile
  ON scanned_pages (scan_id)
  WHERE has_mobile_issues = true;

-- ── 4. Pattern refresh queue ──────────────────────────────────────────────────
-- Query: SELECT ... FROM issue_patterns WHERE needs_refresh = true
--        ORDER BY last_seen_at DESC  (process most-recently-seen first)
-- Combines the needs_refresh partial filter with last_seen_at ordering so the
-- job runner gets the right rows in priority order without a separate sort step.
CREATE INDEX IF NOT EXISTS idx_ip_refresh_queue
  ON issue_patterns (last_seen_at DESC)
  WHERE needs_refresh = true;

-- ── 5. GIN on scanned_pages.network_details ───────────────────────────────────
-- Enables: WHERE network_details @> '{"failed": true}'
--          WHERE network_details ? 'errorText'
-- Only create if network_details is queried via JSONB operators.
CREATE INDEX IF NOT EXISTS idx_scanned_pages_network_gin
  ON scanned_pages USING GIN (network_details)
  WHERE network_details IS NOT NULL;

-- ── 6. Completed scans analytics ─────────────────────────────────────────────
-- Query: SELECT ... FROM scans WHERE status = 'completed'
--        ORDER BY completed_at DESC (dashboard, reporting)
CREATE INDEX IF NOT EXISTS idx_scans_completed_at
  ON scans (completed_at DESC)
  WHERE status = 'completed';

-- ── 7. Issue type + severity grouping ────────────────────────────────────────
-- Supports: GROUP BY type, severity or WHERE type = ? AND severity = ?
-- Composite covers both single-column and two-column filter patterns.
CREATE INDEX IF NOT EXISTS idx_issues_type_severity
  ON issues (type, severity);
