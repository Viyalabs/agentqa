import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const MAX_PAGES_PER_SCAN = 10

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    let pathname = parsed.pathname
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    return `${parsed.origin}${pathname}${parsed.search}`
  } catch {
    return url
  }
}

export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'URL is required' }
  }

  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return { valid: false, error: 'Invalid URL format. Include http:// or https://' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'URL must start with http:// or https://' }
  }

  if (!parsed.hostname) {
    return { valid: false, error: 'Please enter a publicly accessible URL' }
  }

  if (parsed.hostname === 'localhost' && process.env.NODE_ENV === 'production') {
    return { valid: false, error: 'Please enter a publicly accessible URL' }
  }

  return { valid: true }
}

export function isSameOrigin(url: string, baseOrigin: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.origin === baseOrigin
  } catch {
    return false
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Unified score metadata — single source of truth for thresholds
const SCORE_TIERS = [
  { min: 90, color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',  label: 'Excellent' },
  { min: 75, color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',  label: 'Good'      },
  { min: 60, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Fair'      },
  { min: 40, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Poor'      },
  { min: 0,  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: 'Critical'  },
] as const

function getScoreTier(score: number) {
  return SCORE_TIERS.find((t) => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1]
}

export function getScoreColor(score: number): string {
  return getScoreTier(score).color
}

export function getScoreBgColor(score: number): string {
  return getScoreTier(score).bg
}

export function getScoreLabel(score: number): string {
  return getScoreTier(score).label
}

export function truncateUrl(url: string, maxLen = 60): string {
  try {
    const parsed = new URL(url)
    const display = parsed.hostname + parsed.pathname
    if (display.length <= maxLen) return display
    return display.slice(0, maxLen - 3) + '...'
  } catch {
    return url.length <= maxLen ? url : url.slice(0, maxLen - 3) + '...'
  }
}
