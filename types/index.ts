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
  | 'mobile_layout'
  | 'large_asset'

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
  created_at: string
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
}

// API response shapes
export interface StartScanResponse {
  scanId: string
}

export interface ScanStatusResponse {
  scan: Scan
  pages: ScannedPage[]
  issues: Issue[]
  logs: ScanLog[]
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
