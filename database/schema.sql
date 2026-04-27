-- AgentQA Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SCANS
-- ============================================================
CREATE TABLE IF NOT EXISTS scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  score       INTEGER CHECK (score >= 0 AND score <= 100),
  total_pages INTEGER NOT NULL DEFAULT 0,
  total_issues INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);

-- ============================================================
-- SCANNED PAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS scanned_pages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id               UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  url                   TEXT NOT NULL,
  status_code           INTEGER,
  load_time_ms          INTEGER,
  title                 TEXT,
  has_console_errors    BOOLEAN NOT NULL DEFAULT false,
  has_network_failures  BOOLEAN NOT NULL DEFAULT false,
  has_mobile_issues     BOOLEAN NOT NULL DEFAULT false,
  screenshot_url        TEXT,
  mobile_screenshot_url TEXT,
  video_url             TEXT,
  network_details       JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scanned_pages_scan_id ON scanned_pages(scan_id);

-- ============================================================
-- ISSUES
-- ============================================================
CREATE TABLE IF NOT EXISTS issues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  page_id     UUID REFERENCES scanned_pages(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('critical', 'medium', 'low')),
  title       TEXT NOT NULL,
  description TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_scan_id ON issues(scan_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_page_id ON issues(page_id);

-- ============================================================
-- PAGE LOGS (console messages, errors)
-- ============================================================
CREATE TABLE IF NOT EXISTS page_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID NOT NULL REFERENCES scanned_pages(id) ON DELETE CASCADE,
  level       TEXT NOT NULL CHECK (level IN ('error', 'warning', 'info', 'log')),
  message     TEXT NOT NULL,
  source      TEXT,
  stack_trace TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_logs_page_id ON page_logs(page_id);
CREATE INDEX IF NOT EXISTS idx_page_logs_level ON page_logs(level);

-- ============================================================
-- STORAGE BUCKETS (run separately or via Supabase dashboard)
-- ============================================================
-- In Supabase dashboard: Storage > New Bucket > "screenshots" > Public
-- Same bucket is used for videos (stored under videos/{scanId}/{pageId}.webm)
-- and mobile screenshots (stored under {scanId}/{pageId}-mobile.png)
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('screenshots', 'screenshots', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Public read access" ON storage.objects
--   FOR SELECT USING (bucket_id = 'screenshots');
--
-- CREATE POLICY "Service role upload" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'screenshots');

-- ============================================================
-- ROW LEVEL SECURITY (permissive for MVP - no auth)
-- ============================================================
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations from anon key (MVP - add auth later)
CREATE POLICY "Public access to scans" ON scans FOR ALL USING (true);
CREATE POLICY "Public access to scanned_pages" ON scanned_pages FOR ALL USING (true);
CREATE POLICY "Public access to issues" ON issues FOR ALL USING (true);
CREATE POLICY "Public access to page_logs" ON page_logs FOR ALL USING (true);

-- ============================================================
-- WAITLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only on waitlist" ON waitlist FOR ALL USING (false);

-- ============================================================
-- MIGRATION: run these if upgrading an existing database
-- ============================================================
-- ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS has_mobile_issues BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS mobile_screenshot_url TEXT;
-- ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS video_url TEXT;
-- ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS network_details JSONB;
-- ALTER TABLE page_logs ADD COLUMN IF NOT EXISTS stack_trace TEXT;
-- CREATE TABLE IF NOT EXISTS waitlist ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );
