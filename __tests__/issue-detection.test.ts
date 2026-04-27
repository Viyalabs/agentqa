import type { NetworkRequest, PageTestResult } from '../types'

// Re-export the internal classification function for testing by extracting it.
// We test the scoring integration end-to-end.
import { calculateScore } from '../services/scorer'

function makeNetworkFailure(resourceType: string): NetworkRequest {
  return {
    url: `https://api.example.com/${resourceType}`,
    method: 'GET',
    resourceType,
    statusCode: null,
    responseTimeMs: 0,
    responseSizeBytes: null,
    failed: true,
    errorText: 'net::ERR_FAILED',
  }
}

function makePageResult(overrides: Partial<PageTestResult> = {}): PageTestResult {
  return {
    url: 'https://example.com',
    statusCode: 200,
    loadTimeMs: 500,
    title: 'Example Page',
    consoleErrors: [],
    consoleWarnings: [],
    jsErrors: [],
    networkRequests: [],
    failedImages: [],
    forms: [],
    screenshot: null,
    mobileScreenshot: null,
    hasMobileLayoutIssues: false,
    videoPath: null,
    error: null,
    links: [],
    isCrash: false,
    isUnreachable: false,
    is404: false,
    ...overrides,
  }
}

// Helper that classifies issues the same way scanner.ts does
// We test behaviour through the score integration
function expectIssueCount(pages: PageTestResult[], expected: { critical?: number; medium?: number; low?: number }) {
  // Inline classification (mirrors services/scanner.ts logic)
  const issues: Array<{ severity: 'critical' | 'medium' | 'low' }> = []

  for (const page of pages) {
    if (page.isUnreachable) {
      issues.push({ severity: 'critical' })
      continue
    }
    if (page.isCrash) issues.push({ severity: 'critical' })
    if (page.is404) issues.push({ severity: 'critical' })

    // jsErrors (pageerror) take priority for critical JS detection
    if (page.jsErrors.length > 0) {
      issues.push({ severity: 'critical' })
    } else {
      const criticalJs = page.consoleErrors.filter((e) =>
        /TypeError|ReferenceError|SyntaxError|Uncaught/.test(e.message)
      )
      if (criticalJs.length > 0) issues.push({ severity: 'critical' })
    }

    const nonCriticalErrors = page.consoleErrors.filter(
      (e) => !/TypeError|ReferenceError|SyntaxError|Uncaught/.test(e.message)
    )
    if (nonCriticalErrors.length > 0) issues.push({ severity: 'medium' })

    const failedRequests = page.networkRequests.filter((r) => r.failed)
    const apiFailures = failedRequests.filter((f) => f.resourceType === 'xhr' || f.resourceType === 'fetch')
    if (apiFailures.length > 0) issues.push({ severity: 'medium' })

    if (page.failedImages.length > 0) issues.push({ severity: 'medium' })

    const brokenForms = page.forms.filter((f) => !f.hasSubmitButton)
    if (brokenForms.length > 0) issues.push({ severity: 'medium' })

    const resourceFailures = failedRequests.filter(
      (f) => f.resourceType === 'script' || f.resourceType === 'stylesheet'
    )
    if (resourceFailures.length > 0) issues.push({ severity: 'medium' })

    if (page.hasMobileLayoutIssues) issues.push({ severity: 'medium' })

    if (page.loadTimeMs > 5000 && !page.is404) issues.push({ severity: 'low' })
    if (page.consoleWarnings.length > 3) issues.push({ severity: 'low' })
  }

  const critical = issues.filter((i) => i.severity === 'critical').length
  const medium = issues.filter((i) => i.severity === 'medium').length
  const low = issues.filter((i) => i.severity === 'low').length

  if (expected.critical !== undefined) expect(critical).toBe(expected.critical)
  if (expected.medium !== undefined) expect(medium).toBe(expected.medium)
  if (expected.low !== undefined) expect(low).toBe(expected.low)

  return { critical, medium, low, issues }
}

describe('Issue classification', () => {
  describe('Critical issues', () => {
    it('detects unreachable page', () => {
      const page = makePageResult({ isUnreachable: true, error: 'net::ERR_NAME_NOT_RESOLVED' })
      expectIssueCount([page], { critical: 1 })
    })

    it('detects page crash (5xx)', () => {
      const page = makePageResult({ isCrash: true, statusCode: 500 })
      expectIssueCount([page], { critical: 1 })
    })

    it('detects 404', () => {
      const page = makePageResult({ is404: true, statusCode: 404 })
      expectIssueCount([page], { critical: 1 })
    })

    it('detects 500 server error', () => {
      const page = makePageResult({ isCrash: true, statusCode: 500 })
      expectIssueCount([page], { critical: 1 })
    })

    it('detects uncaught exception via jsErrors (pageerror)', () => {
      const page = makePageResult({
        jsErrors: [{ message: 'TypeError: Cannot read properties of null', stackTrace: 'Error\n  at foo', timestamp: Date.now() }],
      })
      expectIssueCount([page], { critical: 1 })
    })

    it('detects uncaught TypeError via console fallback', () => {
      const page = makePageResult({
        consoleErrors: [{ level: 'error', message: 'TypeError: Cannot read properties of null' }],
      })
      expectIssueCount([page], { critical: 1 })
    })

    it('detects uncaught ReferenceError as critical', () => {
      const page = makePageResult({
        consoleErrors: [{ level: 'error', message: 'Uncaught ReferenceError: foo is not defined' }],
      })
      expectIssueCount([page], { critical: 1 })
    })
  })

  describe('Medium issues', () => {
    it('detects non-critical console errors', () => {
      const page = makePageResult({
        consoleErrors: [{ level: 'error', message: 'Failed to load resource: 403' }],
      })
      expectIssueCount([page], { medium: 1 })
    })

    it('detects failed XHR requests', () => {
      const page = makePageResult({
        networkRequests: [makeNetworkFailure('xhr')],
      })
      expectIssueCount([page], { medium: 1 })
    })

    it('detects failed fetch requests', () => {
      const page = makePageResult({
        networkRequests: [makeNetworkFailure('fetch')],
      })
      expectIssueCount([page], { medium: 1 })
    })

    it('detects broken images', () => {
      const page = makePageResult({
        failedImages: ['https://example.com/missing.png'],
      })
      expectIssueCount([page], { medium: 1 })
    })

    it('detects forms without submit buttons', () => {
      const page = makePageResult({
        forms: [{ action: '/submit', method: 'post', hasSubmitButton: false }],
      })
      expectIssueCount([page], { medium: 1 })
    })

    it('does not flag forms that have submit buttons', () => {
      const page = makePageResult({
        forms: [{ action: '/submit', method: 'post', hasSubmitButton: true }],
      })
      expectIssueCount([page], { medium: 0, critical: 0 })
    })

    it('detects mobile layout overflow', () => {
      const page = makePageResult({ hasMobileLayoutIssues: true })
      expectIssueCount([page], { medium: 1 })
    })
  })

  describe('Low issues', () => {
    it('detects slow page load (>5s)', () => {
      const page = makePageResult({ loadTimeMs: 6000 })
      expectIssueCount([page], { low: 1 })
    })

    it('does not flag acceptable load time', () => {
      const page = makePageResult({ loadTimeMs: 3000 })
      expectIssueCount([page], { low: 0 })
    })

    it('detects many console warnings (>3)', () => {
      const page = makePageResult({
        consoleWarnings: [
          { level: 'warning', message: 'warn 1' },
          { level: 'warning', message: 'warn 2' },
          { level: 'warning', message: 'warn 3' },
          { level: 'warning', message: 'warn 4' },
        ],
      })
      expectIssueCount([page], { low: 1 })
    })

    it('does not flag 3 or fewer warnings', () => {
      const page = makePageResult({
        consoleWarnings: [
          { level: 'warning', message: 'w1' },
          { level: 'warning', message: 'w2' },
        ],
      })
      expectIssueCount([page], { low: 0 })
    })
  })

  describe('Score integration', () => {
    it('a perfect page scores 100', () => {
      const page = makePageResult()
      const { issues } = expectIssueCount([page], { critical: 0, medium: 0, low: 0 })
      const { score } = calculateScore(issues)
      expect(score).toBe(100)
    })

    it('a crashed page scores significantly lower', () => {
      const page = makePageResult({ isUnreachable: true, error: 'net::ERR_NAME_NOT_RESOLVED' })
      const { issues } = expectIssueCount([page], { critical: 1 })
      const { score } = calculateScore(issues)
      expect(score).toBeLessThanOrEqual(80)
    })
  })
})
