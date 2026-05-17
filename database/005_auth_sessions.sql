-- Phase 5: Authenticated scanning
-- Run in Supabase SQL editor after schema.sql

-- ── Session store ─────────────────────────────────────────────────────────────
-- Encrypted auth credentials (cookies, storageState, headers) for recurring scans.
-- Raw credentials are never stored — AES-256-GCM encrypted with SESSION_ENCRYPTION_KEY.

CREATE TABLE IF NOT EXISTS scan_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label           TEXT,
  owner_email     TEXT NOT NULL,
  session_kind    TEXT NOT NULL CHECK (session_kind IN ('cookies', 'storage_state', 'headers', 'combined')),
  encrypted_data  TEXT NOT NULL,     -- AES-256-GCM ciphertext, base64
  iv              TEXT NOT NULL,     -- 12-byte GCM IV, base64
  auth_tag        TEXT NOT NULL,     -- 16-byte GCM auth tag, base64
  login_url       TEXT,              -- metadata only — never used to re-authenticate
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,       -- NULL = no expiry; set for ephemeral/inline sessions
  last_used_at    TIMESTAMPTZ,
  use_count       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_email   ON scan_sessions (owner_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON scan_sessions (expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_sessions" ON scan_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Link scans to optional auth sessions ─────────────────────────────────────
ALTER TABLE scans ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES scan_sessions(id) ON DELETE SET NULL;

-- ── Scheduled cleanup: expire sessions older than TTL ────────────────────────
-- Call this from the ai-worker cron or scheduler cron:
-- DELETE FROM scan_sessions WHERE expires_at IS NOT NULL AND expires_at < NOW();
