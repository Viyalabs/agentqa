-- ── Issue Intelligence Layer ──────────────────────────────────────────────────
-- Adds: pgvector embeddings, known failure signature library,
--       issue lifecycle (detected/resolved/reappeared) tracking,
--       and analytics views for framework failure intelligence.
--
-- Run in Supabase SQL editor. Idempotent — safe to re-run.

-- Enable pgvector extension (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Embedding columns ─────────────────────────────────────────────────────────

ALTER TABLE issue_patterns
  ADD COLUMN IF NOT EXISTS embedding         vector(1536),
  ADD COLUMN IF NOT EXISTS recurrence_count  INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avg_days_to_recur REAL;

ALTER TABLE issues_enriched
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Link individual issues to a known failure signature
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS signature_id TEXT;

-- ── Known failure signatures ──────────────────────────────────────────────────
-- Pre-seeded library of well-known framework failure patterns.
-- Populated by services/known-signatures.ts seedKnownSignatures().

CREATE TABLE IF NOT EXISTS failure_signatures (
  id               TEXT PRIMARY KEY,                   -- e.g. 'nextjs-hydration-mismatch'
  framework        TEXT NOT NULL,                      -- 'nextjs' | 'react' | 'shopify' | 'any' …
  name             TEXT NOT NULL,
  description      TEXT,
  issue_type       TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'medium',
  trigger_patterns TEXT[] NOT NULL DEFAULT '{}',       -- regex strings for keyword matching
  root_cause       TEXT NOT NULL,
  fix_suggestion   TEXT NOT NULL,
  docs_url         TEXT,
  embedding        vector(1536),                       -- semantic matching vector
  occurrence_count INTEGER      NOT NULL DEFAULT 0,
  last_seen_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Issue lifecycle events ────────────────────────────────────────────────────
-- Tracks when an issue pattern is first detected, fixed, and reappears.
-- Powers recurrence intelligence and fix-durability scoring.

CREATE TABLE IF NOT EXISTS issue_resolution_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_fingerprint   TEXT        NOT NULL,
  domain                TEXT        NOT NULL,
  scan_id               UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  event_type            TEXT        NOT NULL CHECK (event_type IN ('detected', 'resolved', 'reappeared')),
  days_since_last_event REAL,
  signature_id          TEXT        REFERENCES failure_signatures(id) ON DELETE SET NULL,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- HNSW vector indexes (work on empty tables; no training required)
CREATE INDEX IF NOT EXISTS idx_ip_embedding
  ON issue_patterns   USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_ie_embedding
  ON issues_enriched  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_fs_embedding
  ON failure_signatures USING hnsw (embedding vector_cosine_ops);

-- Issue lifecycle
CREATE INDEX IF NOT EXISTS idx_ire_domain_fp
  ON issue_resolution_events (domain, pattern_fingerprint, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ire_event_type
  ON issue_resolution_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ire_scan
  ON issue_resolution_events (scan_id);

-- Signature lookup on issues
CREATE INDEX IF NOT EXISTS idx_issues_signature_id
  ON issues (signature_id) WHERE signature_id IS NOT NULL;

-- Recurring patterns (non-zero recurrence)
CREATE INDEX IF NOT EXISTS idx_ip_recurrence
  ON issue_patterns (recurrence_count DESC) WHERE recurrence_count > 0;

-- ── SQL functions ─────────────────────────────────────────────────────────────

-- Find semantically similar patterns via ANN cosine search
CREATE OR REPLACE FUNCTION find_semantic_neighbors(
  query_embedding      vector(1536),
  similarity_threshold REAL    DEFAULT 0.85,
  max_results          INTEGER DEFAULT 5
)
RETURNS TABLE (
  pattern_id  UUID,
  fingerprint TEXT,
  similarity  REAL
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    fingerprint,
    (1 - (embedding <=> query_embedding))::REAL AS similarity
  FROM issue_patterns
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) >= similarity_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT max_results;
$$;

-- Find matching known failure signatures by semantic similarity
CREATE OR REPLACE FUNCTION find_signature_by_embedding(
  query_embedding      vector(1536),
  filter_framework     TEXT    DEFAULT NULL,
  similarity_threshold REAL    DEFAULT 0.78,
  max_results          INTEGER DEFAULT 3
)
RETURNS TABLE (
  signature_id TEXT,
  name         TEXT,
  framework    TEXT,
  similarity   REAL
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    name,
    framework,
    (1 - (embedding <=> query_embedding))::REAL AS similarity
  FROM failure_signatures
  WHERE embedding IS NOT NULL
    AND (filter_framework IS NULL OR framework = filter_framework OR framework = 'any')
    AND 1 - (embedding <=> query_embedding) >= similarity_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT max_results;
$$;

-- ── Analytics views ───────────────────────────────────────────────────────────

-- Per-domain recurrence summary
CREATE OR REPLACE VIEW domain_recurrence_summary AS
SELECT
  domain,
  COUNT(*)                  FILTER (WHERE event_type = 'detected')    AS total_detections,
  COUNT(*)                  FILTER (WHERE event_type = 'resolved')    AS total_resolutions,
  COUNT(*)                  FILTER (WHERE event_type = 'reappeared')  AS total_reappearances,
  COUNT(DISTINCT pattern_fingerprint)                                  AS unique_patterns,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'reappeared')::NUMERIC
    / NULLIF(COUNT(*) FILTER (WHERE event_type = 'resolved'), 0) * 100,
    1
  )                                                                    AS recurrence_rate_pct,
  MAX(occurred_at)                                                     AS last_event_at
FROM issue_resolution_events
GROUP BY domain;

-- Per-framework failure analytics (joins issues + scans + scan_frameworks)
CREATE OR REPLACE VIEW framework_failure_analytics AS
SELECT
  sf.framework,
  COUNT(DISTINCT i.scan_id)                                                     AS total_scans_affected,
  COUNT(i.id)                                                                   AS total_issues,
  COUNT(i.id) FILTER (WHERE i.severity = 'critical')                           AS critical_issues,
  COUNT(i.id) FILTER (WHERE i.severity = 'medium')                             AS medium_issues,
  COUNT(i.id) FILTER (WHERE i.severity = 'low')                                AS low_issues,
  ROUND(AVG(s.score))::INTEGER                                                  AS avg_score,
  COUNT(DISTINCT i.signature_id) FILTER (WHERE i.signature_id IS NOT NULL)     AS known_signatures_seen,
  array_agg(DISTINCT i.type)     FILTER (WHERE i.type IS NOT NULL)             AS issue_types,
  array_agg(DISTINCT i.signature_id) FILTER (WHERE i.signature_id IS NOT NULL) AS signatures_seen
FROM issues i
JOIN scans s          ON s.id  = i.scan_id
JOIN scan_frameworks sf ON sf.scan_id = i.scan_id
WHERE s.status = 'completed'
GROUP BY sf.framework;
