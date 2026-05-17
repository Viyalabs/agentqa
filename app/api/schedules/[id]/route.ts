import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'
import { resolveAccess } from '@/lib/access-control'
import { nextRunIso } from '@/lib/scheduler'

export const runtime = 'nodejs'

const PatchSchema = z.object({
  cadence:      z.enum(['daily', 'weekly', 'manual', 'webhook']).optional(),
  enabled:      z.boolean().optional(),
  paused_reason: z.string().nullable().optional(),
  notify_email: z.string().email().optional(),
})

// PATCH /api/schedules/[id] — update cadence, pause/resume, change email
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const db = getAdminClient()
  const { data: existing } = await db
    .from('scan_schedules')
    .select('id, notify_email, cadence')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  const email = req.headers.get('x-notify-email') ?? existing.notify_email
  const founderToken = req.headers.get('x-founder-token')
  const access = resolveAccess(email, founderToken)

  // Non-admin users may only modify their own schedules
  if (!access.bypassRateLimit && existing.notify_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.cadence !== undefined) {
    updates.cadence     = parsed.data.cadence
    updates.next_run_at = nextRunIso(parsed.data.cadence)
  }
  if (parsed.data.enabled !== undefined)      updates.enabled      = parsed.data.enabled
  if (parsed.data.paused_reason !== undefined) updates.paused_reason = parsed.data.paused_reason
  if (parsed.data.notify_email !== undefined) updates.notify_email = parsed.data.notify_email

  // Resume: clear pause and reset failure count
  if (parsed.data.enabled === true || parsed.data.paused_reason === null) {
    updates.paused_reason         = null
    updates.consecutive_failures  = 0
  }

  const { data: updated, error } = await db
    .from('scan_schedules')
    .update(updates)
    .eq('id', id)
    .select('id, domain, cadence, enabled, next_run_at, paused_reason')
    .single()

  if (error) {
    console.error('[PATCH /api/schedules/[id]] DB error:', error.message)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }

  return NextResponse.json(updated)
}

// DELETE /api/schedules/[id] — disable (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getAdminClient()

  const { data: existing } = await db
    .from('scan_schedules')
    .select('id, notify_email')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  const email = req.headers.get('x-notify-email') ?? existing.notify_email
  const founderToken = req.headers.get('x-founder-token')
  const access = resolveAccess(email, founderToken)

  if (!access.bypassRateLimit && existing.notify_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await db
    .from('scan_schedules')
    .update({ enabled: false, paused_reason: 'user', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[DELETE /api/schedules/[id]] DB error:', error.message)
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
