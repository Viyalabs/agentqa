import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentqa.viyalabs.com'

const RequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 422 }
    )
  }

  const { email } = parsed.data
  const db = getAdminClient()

  const { data: scan } = await db
    .from('scans')
    .select('id, status')
    .eq('id', scanId)
    .single()

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
  }

  if (scan.status === 'completed' || scan.status === 'failed') {
    const reportLink = `${APP_URL}/report/${scanId}`
    return NextResponse.json({
      message: `Scan already complete! View your report: ${reportLink}`,
      reportLink,
    })
  }

  await db
    .from('scans')
    .update({ notify_email: email })
    .eq('id', scanId)

  return NextResponse.json({
    message: "Got it — we'll email you the report link when the scan finishes.",
  })
}
