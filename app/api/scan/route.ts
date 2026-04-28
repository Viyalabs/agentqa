import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'
import { validateUrl, normalizeUrl } from '@/lib/utils'
import { runScan } from '@/services/scanner'

// Node.js runtime required for Playwright (used in local dev path)
export const runtime = 'nodejs'
export const maxDuration = 30

const NOTIFY_EMAIL = 'support@viyalabs.com'
const NOTIFY_WHATSAPP = '9600190022'

const RequestSchema = z.object({
  url: z.string().min(1, 'URL is required').max(2048, 'URL is too long'),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const { url: rawUrl } = parsed.data
  const url = normalizeUrl(rawUrl)

  const { valid, error: urlError } = validateUrl(url)
  if (!valid) {
    return NextResponse.json({ error: urlError }, { status: 422 })
  }

  const db = getAdminClient()
  const { data: scan, error: dbError } = await db
    .from('scans')
    .insert({ url, status: 'pending' })
    .select('id')
    .single()

  if (dbError || !scan) {
    console.error('[POST /api/scan] DB insert error:', dbError?.message)
    return NextResponse.json(
      { error: 'Failed to create scan. Check database configuration.' },
      { status: 500 }
    )
  }

  const scanId: string = scan.id

  // Notifications are best-effort — don't block the response
  void Promise.allSettled([notifyScanEmail(url, scanId), notifyScanWhatsApp(url, scanId)])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const isLocal = process.env.NODE_ENV === 'development' || appUrl.includes('localhost')

  if (isLocal) {
    // Local dev: run inline so we don't need a self-referential HTTP call.
    // void is acceptable here — local process won't be killed mid-scan.
    void runScan(scanId, url).catch((err: unknown) => {
      console.error(`[runScan] unhandled error for ${scanId}:`, err)
    })
  } else {
    // Production: dispatch to the dedicated worker endpoint.
    // waitUntil keeps this function alive long enough to fire the HTTP request;
    // the worker runs as its own Vercel invocation with maxDuration=300.
    waitUntil(
      fetch(`${appUrl}/api/scan/worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId }),
      }).catch((err: unknown) => {
        console.error('[scan] worker dispatch failed:', err)
      })
    )
  }

  return NextResponse.json({ scanId }, { status: 202 })
}

async function notifyScanEmail(url: string, scanId: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? 'AgentQA <noreply@agentqa.dev>',
      to: [NOTIFY_EMAIL],
      subject: `New scan started: ${url}`,
      html: `
        <h2>New AgentQA Scan Started</h2>
        <p><strong>URL:</strong> ${url}</p>
        <p><strong>Scan ID:</strong> ${scanId}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <hr/>
        <p style="color:#888;font-size:12px">Sent by AgentQA — a Viyalabs product</p>
      `,
    }),
  })
    .then(async (res) => {
      if (!res.ok) console.error('[scan] Resend error:', await res.text())
    })
    .catch(() => {})
}

async function notifyScanWhatsApp(url: string, scanId: string): Promise<void> {
  const apiKey = process.env.CALLMEBOT_API_KEY
  if (!apiKey) return

  const text = encodeURIComponent(`New AgentQA scan!\nURL: ${url}\nScan ID: ${scanId}`)
  const endpoint = `https://api.callmebot.com/whatsapp.php?phone=${NOTIFY_WHATSAPP}&text=${text}&apikey=${apiKey}`

  await fetch(endpoint)
    .then(async (res) => {
      if (!res.ok) console.error('[scan] CallMeBot error:', await res.text())
    })
    .catch(() => {})
}
