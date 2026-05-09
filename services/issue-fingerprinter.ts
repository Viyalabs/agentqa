import type { IssueClassified } from '@/types'

// Patterns to strip from error messages before hashing
const RE_UUID      = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const RE_HEX       = /0x[0-9a-fA-F]{4,}/g
const RE_TIMESTAMP = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/g
const RE_LINE_COL  = /:\d+:\d+/g                        // :42:15 source locations
const RE_STACK_AT  = /\s+at\s+\S+.*$/gm                 // stack trace lines
const RE_NUM_SEG   = /\/\d{2,}/g                        // /123/ path segments
const RE_HASH_SEG  = /\/[a-f0-9]{8,}\./g               // /abc12345.js chunk hashes
const RE_WHITESPACE = /\s+/g

/**
 * Strip variable parts from an error message so the same logical error
 * produces the same normalized string regardless of line numbers, IDs, etc.
 */
function normalizeMessage(msg: string): string {
  return msg
    .replace(RE_TIMESTAMP, 'TS')
    .replace(RE_UUID, 'UUID')
    .replace(RE_HEX, '0xHEX')
    .replace(RE_STACK_AT, '')
    .replace(RE_LINE_COL, ':L')
    .replace(RE_WHITESPACE, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 120)
}

/**
 * Normalize a URL/path: strip origin, replace numeric/UUID path segments,
 * and remove chunk hashes so /dashboard/123 → /dashboard/:id.
 */
function normalizePath(raw: string): string {
  let path = raw
  try {
    path = new URL(raw).pathname
  } catch {
    // already a path or malformed — use as-is
  }
  return path
    .replace(RE_UUID, 'UUID')
    .replace(RE_NUM_SEG, '/:id')
    .replace(RE_HASH_SEG, '/HASH.')
    .toLowerCase()
    .slice(0, 80)
}

/**
 * Make a slug-safe string — only lowercase alphanumeric, colons, hyphens, slashes.
 */
function slugify(s: string): string {
  return s.replace(/[^a-z0-9:/_-]/g, '-').replace(/-{2,}/g, '-')
}

/**
 * Compute a stable fingerprint for a classified issue.
 *
 * The fingerprint is deterministic: the same logical bug across different
 * scans or pages produces the same string, enabling cross-scan deduplication.
 *
 * Format: `{type}:{discriminator_parts…}`
 */
export function fingerprint(issue: IssueClassified): string {
  const parts: string[] = [issue.type]
  const d = issue.details ?? {}

  switch (issue.type) {
    case 'js_error': {
      // Key discriminator: error class + normalized message
      const errors = (d.errors as string[] | undefined) ?? []
      const raw = errors[0] ?? issue.description ?? ''
      // Extract error class (TypeError, ReferenceError, etc.)
      const errorClass = raw.match(/^([A-Za-z]+Error|[A-Za-z]+Exception)/)?.[1] ?? 'Error'
      // Strip the class prefix and normalize
      const body = normalizeMessage(raw.replace(/^[A-Za-z]+Error:\s*/i, ''))
      parts.push(errorClass.toLowerCase(), body.slice(0, 80))
      break
    }

    case 'console_error': {
      const errors = (d.errors as string[] | undefined) ?? []
      const raw = errors[0] ?? issue.description ?? ''
      parts.push(normalizeMessage(raw).slice(0, 80))
      break
    }

    case 'network_failure': {
      // Key discriminator: HTTP method + normalized resource path
      const failures = (d.failures as Array<{ url?: string; method?: string }> | undefined) ?? []
      if (failures.length > 0) {
        const { url = '', method = 'GET' } = failures[0]
        parts.push(method.toLowerCase(), normalizePath(url))
      } else {
        parts.push(normalizeMessage(issue.description ?? '').slice(0, 60))
      }
      break
    }

    case 'page_not_found':
    case 'page_crash':
    case 'navigation_failure': {
      // Key discriminator: normalized URL + status code
      parts.push(normalizePath((d.url as string | undefined) ?? ''))
      if (d.statusCode) parts.push(String(d.statusCode))
      break
    }

    case 'missing_image': {
      // Key discriminator: normalized paths of the first few broken images
      const images = (d.images as string[] | undefined) ?? []
      const paths = images.slice(0, 3).map(normalizePath).join(',')
      parts.push(paths.slice(0, 80))
      break
    }

    case 'mobile_layout': {
      // One pattern per normalized page path
      parts.push(normalizePath((d.url as string | undefined) ?? ''))
      break
    }

    case 'slow_load': {
      // Bucket by magnitude: 5–10 s / 10–20 s / 20 s+
      const ms = (d.loadTimeMs as number | undefined) ?? 0
      parts.push(ms > 20_000 ? '20s+' : ms > 10_000 ? '10s+' : '5s+')
      break
    }

    case 'large_asset': {
      // Bucket by total size
      const assets = (d.assets as Array<{ sizeKb: number }> | undefined) ?? []
      const totalKb = assets.reduce((s, a) => s + a.sizeKb, 0)
      parts.push(totalKb > 2000 ? '2mb+' : totalKb > 1000 ? '1mb+' : '500kb+')
      break
    }

    case 'broken_form': {
      parts.push(normalizePath((d.url as string | undefined) ?? ''))
      break
    }

    default: {
      parts.push(normalizeMessage(issue.description ?? '').slice(0, 80))
    }
  }

  return slugify(parts.filter(Boolean).join(':'))
}

/**
 * Compute a "family" cluster key — a less-specific version of the fingerprint
 * that groups similar issues into the same pattern cluster.
 *
 * Examples:
 *   js_error:typeerror:cannot-read-property-of-null  → "js_error:typeerror"
 *   network_failure:get:/api/users/:id               → "network_failure:get"
 *   slow_load:5s+                                    → "slow_load:elevated"
 */
export function clusterKey(issue: IssueClassified): string {
  const d = issue.details ?? {}

  switch (issue.type) {
    case 'js_error': {
      const errors = (d.errors as string[] | undefined) ?? []
      const raw = errors[0] ?? issue.description ?? ''
      const errorClass = raw.match(/^([A-Za-z]+Error|[A-Za-z]+Exception)/)?.[1] ?? 'Error'
      return `js_error:${errorClass.toLowerCase()}`
    }

    case 'console_error': {
      const errors = (d.errors as string[] | undefined) ?? []
      const raw = errors[0] ?? issue.description ?? ''
      const STOP = new Set(['error', 'failed', 'cannot', 'could', 'warning', 'uncaught', 'undefined'])
      const tokens = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
      const key = tokens.find(t => t.length > 3 && !STOP.has(t)) ?? 'generic'
      return `console_error:${key.slice(0, 24)}`
    }

    case 'network_failure': {
      const failures = (d.failures as Array<{ method?: string }> | undefined) ?? []
      const method = failures[0]?.method?.toLowerCase() ?? 'get'
      return `network_failure:${method}`
    }

    case 'slow_load': {
      const ms = (d.loadTimeMs as number | undefined) ?? 0
      return `slow_load:${ms > 20_000 ? 'severe' : ms > 10_000 ? 'high' : 'elevated'}`
    }

    case 'large_asset': {
      const assets = (d.assets as Array<{ sizeKb: number }> | undefined) ?? []
      const totalKb = assets.reduce((s, a) => s + a.sizeKb, 0)
      return `large_asset:${totalKb > 2000 ? 'critical' : 'high'}`
    }

    case 'console_warning': {
      const errors = (d.errors as string[] | undefined) ?? []
      const raw = errors[0] ?? issue.description ?? ''
      const tokens = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
      const key = tokens.find(t => t.length > 4) ?? 'generic'
      return `console_warning:${key.slice(0, 20)}`
    }

    default:
      return issue.type
  }
}
