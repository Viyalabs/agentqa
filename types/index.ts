export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed'

export type IssueSeverity = 'critical' | 'medium' | 'low'

export type IssueType =
  | 'page_crash'
  | 'page_not_found'
  | 'navigation_failure'
  | 'js_error'
  | 'console_error'
  | 'network_failure'
  | 'missing_image'
  | 'broken_form'
  | 'slow_load'
  | 'console_warning'

export interface Scan {
  id: string
  url: string
  status: ScanStatus
  score: number | null
  total_pages: number
  total_issues: number
  error_message: string | null
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
  screenshot_url: string | null
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
  created_at: string
}

export interface PageLog {
  id: string
  page_id: string
  level: string
  message: string
  source: string | null
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
  networkFailures: Array<{
    url: string
    status: number | null
    method: string
    resourceType: string
  }>
  failedImages: string[]
  forms: Array<{
    action: string | null
    method: string
    hasSubmitButton: boolean
  }>
  screenshot: Buffer | null
  error: string | null
  /** Absolute same-origin links discovered on this page */
  links: string[]
  /** Page rendered but threw a JS exception or the server returned 5xx */
  isCrash: boolean
  /** URL was unreachable (DNS failure, connection refused, timeout) */
  isUnreachable: boolean
  is404: boolean
}

// API response shapes
export interface StartScanResponse {
  scanId: string
}

export interface ScanStatusResponse {
  scan: Scan
  pages: ScannedPage[]
  issues: Issue[]
}

export interface IssueClassified {
  scan_id: string
  page_id: string | null
  type: IssueType
  severity: IssueSeverity
  title: string
  description: string | null
  details: Record<string, unknown> | null
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
