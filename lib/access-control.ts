/**
 * Role-based access control for AgentQA.
 *
 * Roles are resolved purely from environment variables — no database or auth
 * session required. This is the right trade-off for the current stage: env
 * config is cheap to change on redeploy and requires zero schema work.
 *
 * Architecture is designed for future upgrade: swap resolveAccess() for a DB
 * lookup once proper auth (Supabase Auth / Clerk / etc.) is added. All
 * consumers already receive a `UserAccess` object, so the upgrade is local.
 *
 * Environment variables:
 *   INTERNAL_EMAILS   — comma-separated founder/admin emails → admin role
 *   BETA_EMAILS       — comma-separated beta tester emails  → beta role
 *   FOUNDER_TOKEN     — secret token (x-founder-token header) → admin role
 *                       allows bypass without supplying an email address
 *
 * Role hierarchy:  admin > beta > pro (future) > free
 */

export type UserRole = 'admin' | 'beta' | 'pro' | 'free'

export interface UserAccess {
  role: UserRole
  /** Normalised email, or null when not provided / not recognised. */
  email: string | null
  /** Skip the per-IP scan rate limit entirely. */
  bypassRateLimit: boolean
  /** Max scans allowed within the rate-limit window (Infinity = unlimited). */
  scansPerWindow: number
  /** Rate-limit window in minutes. */
  windowMinutes: number
  /** Max AI representatives analyzed per scan (mirrors AI_MAX_REPRESENTATIVES_PER_SCAN). */
  aiRepresentatives: number
  /** Include internal timing/cache debug fields in API responses. */
  showDebugInfo: boolean
}

// ── Quota constants ───────────────────────────────────────────────────────────

const FREE_SCANS_PER_WINDOW  = 5    // raised from 3
const FREE_WINDOW_MINUTES    = 60
const BETA_SCANS_PER_WINDOW  = 20
const BETA_WINDOW_MINUTES    = 60

// ── Email list helpers ────────────────────────────────────────────────────────

/** Parse a comma-separated env var into a lowercase trimmed Set. */
function parseEmailList(envKey: string): Set<string> {
  const raw = process.env[envKey] ?? ''
  return new Set(
    raw.split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

// Cached after first read so repeated requests don't re-parse env strings.
// The cache is reset on each Vercel function cold start (env changes on redeploy).
let _adminEmails: Set<string> | null = null
let _betaEmails:  Set<string> | null = null

function getAdminEmails(): Set<string> {
  if (!_adminEmails) _adminEmails = parseEmailList('INTERNAL_EMAILS')
  return _adminEmails
}

function getBetaEmails(): Set<string> {
  if (!_betaEmails) _betaEmails = parseEmailList('BETA_EMAILS')
  return _betaEmails
}

// ── Role constructors ─────────────────────────────────────────────────────────

function adminAccess(email: string | null): UserAccess {
  return {
    role:             'admin',
    email,
    bypassRateLimit:  true,
    scansPerWindow:   Number.POSITIVE_INFINITY,
    windowMinutes:    FREE_WINDOW_MINUTES,
    aiRepresentatives: Number.POSITIVE_INFINITY,
    showDebugInfo:    true,
  }
}

function betaAccess(email: string): UserAccess {
  return {
    role:             'beta',
    email,
    bypassRateLimit:  false,
    scansPerWindow:   BETA_SCANS_PER_WINDOW,
    windowMinutes:    BETA_WINDOW_MINUTES,
    aiRepresentatives: 50,
    showDebugInfo:    false,
  }
}

function freeAccess(email: string | null): UserAccess {
  return {
    role:             'free',
    email,
    bypassRateLimit:  false,
    scansPerWindow:   FREE_SCANS_PER_WINDOW,
    windowMinutes:    FREE_WINDOW_MINUTES,
    aiRepresentatives: 20,
    showDebugInfo:    false,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve the access level for an incoming request.
 *
 * Call once per request. Resolution order:
 *   1. `founderToken` matches FOUNDER_TOKEN env var → admin (email optional)
 *   2. email matches INTERNAL_EMAILS list           → admin
 *   3. email matches BETA_EMAILS list               → beta
 *   4. anything else                                → free
 *
 * @param email        Email supplied in the request body (may be absent).
 * @param founderToken Value of the x-founder-token request header (may be absent).
 */
export function resolveAccess(
  email?: string | null,
  founderToken?: string | null,
): UserAccess {
  // Layer 1: FOUNDER_TOKEN header — allows bypass without a registered email.
  const envToken = process.env.FOUNDER_TOKEN
  if (envToken && founderToken && founderToken === envToken) {
    const normalized = email?.trim().toLowerCase() ?? null
    console.log(`[access-control] admin via token email:${normalized ?? 'none'}`)
    return adminAccess(normalized)
  }

  const normalized = email?.trim().toLowerCase() ?? null

  // Layer 2: email in INTERNAL_EMAILS list → admin
  if (normalized && getAdminEmails().has(normalized)) {
    console.log(`[access-control] admin via email:${normalized}`)
    return adminAccess(normalized)
  }

  // Layer 3: email in BETA_EMAILS list → beta
  if (normalized && getBetaEmails().has(normalized)) {
    console.log(`[access-control] beta via email:${normalized}`)
    return betaAccess(normalized)
  }

  // Default: free tier
  return freeAccess(normalized)
}

/**
 * Human-readable description of the rate limit for use in error messages.
 * Example: "5 scans per 60 minutes"
 */
export function rateLimitDescription(access: UserAccess): string {
  if (access.scansPerWindow === Number.POSITIVE_INFINITY) return 'unlimited scans'
  return `${access.scansPerWindow} scan${access.scansPerWindow !== 1 ? 's' : ''} per ${access.windowMinutes} minute${access.windowMinutes !== 1 ? 's' : ''}`
}
