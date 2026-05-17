/**
 * Scheduler utilities — schedule creation, cadence math, and free-tier enforcement.
 */

import type { ScheduleCadence } from '@/types'

/** Compute the first next_run_at for a new schedule */
export function computeNextRunAt(cadence: ScheduleCadence): Date {
  const now = new Date()
  switch (cadence) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    case 'manual':
    case 'webhook':
      // Far future — only triggered explicitly
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  }
}

/** Human-readable cadence label */
export function cadenceLabel(cadence: ScheduleCadence): string {
  const labels: Record<ScheduleCadence, string> = {
    daily:   'Daily',
    weekly:  'Weekly',
    manual:  'Manual',
    webhook: 'On deploy',
  }
  return labels[cadence]
}

/** ISO string for next_run_at */
export function nextRunIso(cadence: ScheduleCadence): string {
  return computeNextRunAt(cadence).toISOString()
}

/** How many minutes until the schedule fires */
export function minutesUntilNextRun(nextRunAt: string): number {
  return Math.max(0, Math.round((new Date(nextRunAt).getTime() - Date.now()) / 60_000))
}

/** Generate a random HMAC-safe webhook secret (32 hex chars) */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Verify a webhook request signature. Returns true if valid. */
export async function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    const expected = 'sha256=' + Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    return expected === signature
  } catch {
    return false
  }
}
