-- ============================================================
-- Migration 004 — Atomic job claim function
-- Replaces the racy SELECT + UPDATE pattern in claimNextJob()
-- with a single statement using FOR UPDATE SKIP LOCKED.
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

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

-- Allow the service role (used by the worker) to execute this function
GRANT EXECUTE ON FUNCTION claim_next_ai_job() TO service_role;
