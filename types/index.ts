export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed'

export type ScheduleCadence = 'daily' | 'weekly' | 'manual' | 'webhook'

export type ChangeKind = 'new' | 'resolved' | 'recurring' | 'worsened' | 'improved'

export type IssueStateStatus = 'open' | 'resolved' | 'recurring'

export type IssueSeverity = 'critical' | 'medium' | 'low'

export type IssueType =
  | 'page_crash'
  | 'page_not_found'
  | 'navigation_failure'
  | 'js_error'
  | 'console_error'
  | 'network_failure'
  | 'missing_image'
  | 'missing_alt'
  | 'missing_meta'
  | 'broken_form'
  | 'slow_load'
  | 'console_warning'
  | 'mobile_layout'
  | 'large_asset'
  // Phase 5 — authenticated scanning
  | 'auth_redirect'    // page redirected to a login URL
  | 'auth_wall'        // page rendered a login form (auth not injected or expired)
  | 'auth_expired'     // session-expiry signal detected mid-crawl

// ── Auth session types ────────────────────────────────────────────────────────

export interface AuthCookie {
  name:     string
  value:    string
  domain?:  string
  path?:    string
  secure?:  boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  expires?:  number  // Unix timestamp
}

/** All supported auth injection strategies — include one or more fields. */
export interface AuthConfig {
  /** Primary strategy identifier (informational; all present fields are applied). */
  kind: 'cookies' | 'storage_state' | 'headers' | 'combined'
  /** Browser cookies to inject before the first navigation. */
  cookies?: AuthCookie[]
  /** JSON-encoded Playwright storageState — contains cookies + localStorage. */
  storageState?: string
  /** Extra HTTP headers sent on every request (e.g. Authorization: Bearer xyz). */
  headers?: Record<string, string>
  /** Original login URL — metadata only, used for session-expiry correlation. */
  loginUrl?: string
}

export interface NetworkRequest {
  url: string
  method: string
  resourceType: string
  statusCode: number | null
  responseTimeMs: number
  responseSizeBytes: number | null
  failed: boolean
  errorText: string | null
}

export interface Scan {
  id: string
  url: string
  status: ScanStatus
  score: number | null
  total_pages: number
  total_issues: number
  error_message: string | null
  notify_email: string | null
  ai_overview: string | null
  ai_tokens_in: number
  ai_tokens_out: number
  // Regression counts (Phase 2 — basic)
  regression_new: number
  regression_resolved: number
  // Regression counts (Phase 4 — enhanced)
  regression_recurring: number
  regression_worsened: number
  regression_improved: number
  score_delta: number | null
  // Scheduling
  domain: string | null
  schedule_id: string | null
  prev_scan_id: string | null
  run_sequence: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ScannedPage {
  id: string
  scan_id: string
  url: string
  status_code: number | null
  load_time_ms: number | null
  title: string | null
  has_console_errors: boolean
  has_network_failures: boolean
  has_mobile_issues: boolean
  screenshot_url: string | null
  mobile_screenshot_url: string | null
  video_url: string | null
  network_details: NetworkRequest[] | null
  created_at: string
}

export interface Issue {
  id: string
  scan_id: string
  page_id: string | null
  type: IssueType
  severity: IssueSeverity
  title: string
  description: string | null
  details: Record<string, unknown> | null
  ai_summary: string | null
  root_cause: string | null
  fix_suggestion: string | null
  fingerprint: string | null
  framework: string | null
  created_at: string
  // Joined from issue_patterns — present in API responses, not in DB rows directly
  pattern_count?: number | null
  total_scans_affected?: number | null
  pattern_frameworks?: string[]
  // Joined from issues_enriched — present after async AI analysis completes
  confidence?: number | null
  from_pattern?: boolean | null
  // User feedback on AI fix suggestion
  fix_helpful?: boolean | null
}

export interface PageLog {
  id: string
  page_id: string
  level: string
  message: string
  source: string | null
  stack_trace: string | null
  created_at: string
}

// Internal crawler types
export interface PageTestResult {
  url: string
  statusCode: number | null
  loadTimeMs: number
  title: string
  consoleErrors: Array<{ level: string; message: string }>
  consoleWarnings: Array<{ level: string; message: string }>
  /** Uncaught JS exceptions captured via page.on('pageerror') — always have stack traces */
  jsErrors: Array<{ message: string; stackTrace: string | null; timestamp: number }>
  networkRequests: NetworkRequest[]
  failedImages: string[]
  missingAltCount: number
  missingMetaDescription: boolean
  missingViewport: boolean
  missingOgImage: boolean
  h1Count: number
  forms: Array<{
    action: string | null
    method: string
    hasSubmitButton: boolean
  }>
  screenshot: Buffer | null
  mobileScreenshot: Buffer | null
  hasMobileLayoutIssues: boolean
  /** Local file path to the recorded video (only set when context has recordVideo enabled) */
  videoPath: string | null
  error: string | null
  /** Absolute same-origin links discovered on this page */
  links: string[]
  /** Page rendered but threw a JS exception or the server returned 5xx */
  isCrash: boolean
  /** URL was unreachable (DNS failure, connection refused, timeout) */
  isUnreachable: boolean
  is404: boolean
  // Phase 5 — auth detection
  /** Page shows a login form or auth wall (password input present). */
  isAuthWall: boolean
  /** Final URL after navigation if it looks like a login/auth redirect. */
  authRedirectUrl: string | null
  /** Session-expiry language detected in DOM (only meaningful when auth was injected). */
  hasExpiredSession: boolean
}

// API response shapes
export interface StartScanResponse {
  scanId: string
}

export interface ScanHistoryEntry {
  id: string
  score: number | null
  completed_at: string
}

export interface ScanStatusResponse {
  scan: Scan
  pages: ScannedPage[]
  issues: Issue[]
  logs: ScanLog[]
  frameworks: string[]
  history: ScanHistoryEntry[]
}

export interface IssueClassified {
  scan_id: string
  page_id: string | null
  type: IssueType
  severity: IssueSeverity
  title: string
  description: string | null
  details: Record<string, unknown> | null
  signature_id?: string | null   // matched known failure signature (Phase 6)
}

export interface ScanLog {
  id: number
  scan_id: string
  message: string
  created_at: string
}

export interface ScoreBreakdown {
  score: number
  criticalCount: number
  mediumCount: number
  lowCount: number
  criticalDeduction: number
  mediumDeduction: number
  lowDeduction: number
}

// ── AI Moat types ──────────────────────────────────────────────────────────────

export interface DetectedFramework {
  framework: string
  confidence: number
  signals: string[]
}

export interface IssuePattern {
  id: string
  fingerprint: string
  type: IssueType
  severity: IssueSeverity
  title: string
  occurrence_count: number
  affected_frameworks: string[]
  root_cause_template: string | null
  fix_template: string | null
  first_seen_at: string
  last_seen_at: string
  // Phase 6 — recurrence intelligence
  recurrence_count:  number
  first_resolved_at: string | null
  avg_days_to_recur: number | null
}

export interface PatternMatchResult {
  patternId: string
  fingerprint: string
  isNew: boolean
  occurrenceCount: number
  rootCauseTemplate: string | null
  fixTemplate: string | null
  needsRefresh: boolean
}

// ── Phase 4 — Recurring Scans & Reliability Intelligence ──────────────────────

export interface ScanSchedule {
  id: string
  domain: string
  url: string
  cadence: ScheduleCadence
  notify_email: string
  is_internal: boolean
  enabled: boolean
  webhook_secret: string | null
  last_run_at: string | null
  last_scan_id: string | null
  next_run_at: string
  consecutive_failures: number
  paused_reason: string | null
  created_by_ip: string | null
  created_at: string
  updated_at: string
}

export interface ScanRun {
  id: string
  schedule_id: string
  scan_id: string
  triggered_by: 'cron' | 'webhook' | 'manual' | 'retry'
  created_at: string
}

export interface ScanRegression {
  id: string
  scan_id: string
  prev_scan_id: string | null
  schedule_id: string | null
  domain: string
  fingerprint: string
  issue_type: string
  severity: IssueSeverity
  change_kind: ChangeKind
  prev_severity: IssueSeverity | null
  curr_severity: IssueSeverity | null
  prev_count: number
  curr_count: number
  first_seen_at: string | null
  days_unresolved: number
  created_at: string
}

export interface DomainIssueState {
  id: string
  domain: string
  fingerprint: string
  pattern_id: string | null
  first_seen_at: string
  first_seen_scan_id: string | null
  last_seen_at: string
  last_seen_scan_id: string | null
  last_resolved_at: string | null
  last_resolved_scan_id: string | null
  total_occurrences: number
  consecutive_scans_seen: number
  consecutive_scans_clean: number
  current_status: IssueStateStatus
  current_severity: IssueSeverity | null
  resolution_count: number
  reopen_count: number
  updated_at: string
}

export interface DomainTimelineEntry {
  scan_id: string
  completed_at: string
  score: number | null
  score_delta: number | null
  run_sequence: number | null
  regression_new: number
  regression_resolved: number
  regression_recurring: number
  regression_worsened: number
  regression_improved: number
}

export interface AlertRule {
  id: string
  schedule_id: string | null
  domain: string | null
  rule_kind: 'score_drop' | 'new_critical' | 'unresolved_days' | 'regression_count' | 'any_new_regression' | 'fix_verified'
  threshold: Record<string, unknown>
  channel: 'email' | 'webhook' | 'slack'
  channel_target: string
  enabled: boolean
  cooldown_minutes: number
  last_fired_at: string | null
  created_at: string
}

// ── Phase 6 — Issue Intelligence & Failure Memory ─────────────────────────────

export interface FailureSignature {
  id:               string
  framework:        string
  name:             string
  description:      string | null
  issueType:        string
  severity:         IssueSeverity
  triggerPatterns:  string[]
  rootCause:        string
  fixSuggestion:    string
  docsUrl:          string | null
  occurrenceCount:  number
  lastSeenAt:       string | null
}

export interface RecurrenceEvent {
  id:                   string
  patternFingerprint:   string
  domain:               string
  scanId:               string
  eventType:            'detected' | 'resolved' | 'reappeared'
  daysSinceLastEvent:   number | null
  signatureId:          string | null
  occurredAt:           string
}

export interface FrameworkStat {
  framework:            string
  totalScansAffected:   number
  totalIssues:          number
  criticalIssues:       number
  mediumIssues:         number
  lowIssues:            number
  avgScore:             number | null
  knownSignaturesSeen:  number
  issueTypes:           string[]
  signaturesSeen:       string[]
}

export interface IntelligenceSummary {
  patterns: {
    topRecurring:    IssuePattern[]
    knownSignatures: FailureSignature[]
  }
  frameworks:   FrameworkStat[]
  recurrence: {
    totalDetections:      number
    totalResolutions:     number
    totalReappearances:   number
    avgDaysToRecur:       number | null
    recurrenceRatePct:    number | null
  }
  generatedAt: string
}

export interface PlatformMetrics {
  active_domains_30d: number
  scans_7d: number
  active_schedules: number
  top_domains: Array<{ domain: string; scan_count: number; avg_score: number | null }>
  repeat_users: Array<{ email: string; scan_count: number; first_scan: string; last_scan: string }>
  cache_hit_rate_7d: number | null
  issue_recurrence_rate: number | null
  schedule_health: Array<{ cadence: string; total: number; paused: number }>
}
