import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qa.viyalabs.com'

// Override via RESEND_NOTIFY_EMAIL env var (useful when using onboarding@resend.dev sender without domain verification)
const NOTIFY_EMAIL = process.env.RESEND_NOTIFY_EMAIL ?? 'support@viyalabs.com'
const NOTIFY_WHATSAPP = '9600190022'

const RequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().max(100).optional(),
  // Optional — provided when the user signs up from a completed scan report
  scanId: z.string().uuid().optional(),
  scannedUrl: z.string().url().optional(),
})

export async function POST(req: NextRequest) {
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

  const { email, name, scanId, scannedUrl } = parsed.data
  const db = getAdminClient()

  const { error: dbError } = await db
    .from('waitlist')
    .insert({ email, name: name ?? null })

  if (dbError) {
    if (dbError.code === '23505') {
      // Already on list — still send the report link if this came from a scan
      if (scanId) {
        await sendReportEmail(email, scanId, scannedUrl)
      }
      const message = scanId
        ? "Report link sent! You're already on our list."
        : "You're already on the waitlist!"
      return NextResponse.json({ message })
    }
    console.error('[waitlist] DB insert error:', dbError.message)
    return NextResponse.json({ error: 'Failed to join waitlist. Please try again.' }, { status: 500 })
  }

  // Notifications — best-effort, don't fail the request if these fail
  const tasks: Promise<void>[] = [
    sendAdminNotification(email, name, scanId, scannedUrl),
    sendWhatsAppNotification(email, name, scannedUrl),
  ]
  if (scanId) {
    tasks.push(sendReportEmail(email, scanId, scannedUrl))
  }
  await Promise.allSettled(tasks)

  const message = scanId
    ? "Report link sent! Check your inbox — we'll also let you know when Pro launches."
    : "You're on the list! We'll email you when Pro launches."

  return NextResponse.json({ message })
}

async function resendPost(payload: Record<string, unknown>): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[waitlist:email] RESEND_API_KEY not set — skipping email')
    return false
  }
  const from = process.env.RESEND_FROM_EMAIL ?? 'AgentQA <noreply@viyalabs.com>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, ...payload }),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`[waitlist:email] Resend rejected (${res.status}):`, text)
      return false
    }
    return true
  } catch (err) {
    console.error('[waitlist:email] Network error:', err)
    return false
  }
}

async function sendAdminNotification(
  email: string,
  name?: string,
  scanId?: string,
  scannedUrl?: string,
): Promise<void> {
  const reportLink = scanId ? `${APP_URL}/report/${scanId}` : null
  console.log(`[waitlist:admin] Notifying ${NOTIFY_EMAIL} about ${email}`)
  await resendPost({
    to: [NOTIFY_EMAIL],
    subject: scanId ? `Scan lead captured: ${email}` : `New waitlist signup: ${email}`,
    html: `
      <h2>${scanId ? 'New Lead from Scan Report' : 'New AgentQA Pro Waitlist Signup'}</h2>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Name:</strong> ${name ?? '—'}</p>
      ${scannedUrl ? `<p><strong>Scanned URL:</strong> ${scannedUrl}</p>` : ''}
      ${reportLink ? `<p><strong>Report:</strong> <a href="${reportLink}">${reportLink}</a></p>` : ''}
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <hr/>
      <p style="color:#888;font-size:12px">Sent by AgentQA — a Viyalabs product</p>
    `,
  })
}

async function sendReportEmail(
  email: string,
  scanId: string,
  scannedUrl?: string,
): Promise<void> {
  const reportLink = `${APP_URL}/report/${scanId}`
  console.log(`[waitlist:report] Sending report link to ${email}`)
  await resendPost({
    to: [email],
    subject: 'Your AgentQA report is ready',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0F;color:#fff;padding:40px 32px;border-radius:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
          <span style="font-size:20px">⚡</span>
          <span style="font-weight:700;font-size:18px;color:#fff">AgentQA</span>
        </div>
        <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 8px">Your QA report is ready</h1>
        ${scannedUrl ? `<p style="color:#71717a;margin:0 0 24px;font-size:14px">Scanned: <span style="color:#a1a1aa">${scannedUrl}</span></p>` : ''}
        <a href="${reportLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:32px">
          View Full Report →
        </a>
        <p style="color:#52525b;font-size:13px;margin:0 0 8px">
          This link is permanent — bookmark it or share it with your team.
        </p>
        <hr style="border:none;border-top:1px solid #27272a;margin:24px 0"/>
        <p style="color:#3f3f46;font-size:12px;margin:0">
          You're on the early access list for AgentQA Pro. We'll let you know when it launches.
          <br/>AgentQA by <a href="https://viyalabs.com" style="color:#3f3f46">Viyalabs</a>
        </p>
      </div>
    `,
  })
}

async function sendWhatsAppNotification(
  email: string,
  name?: string,
  scannedUrl?: string,
): Promise<void> {
  const apiKey = process.env.CALLMEBOT_API_KEY
  if (!apiKey) {
    console.warn('[waitlist] CALLMEBOT_API_KEY not set — skipping WhatsApp notification')
    return
  }

  const displayName = name ? `${name} (${email})` : email
  const lines = [`New AgentQA lead!\nEmail: ${email}`]
  if (scannedUrl) lines.push(`URL: ${scannedUrl}`)
  const text = encodeURIComponent(lines.join('\n'))
  const url = `https://api.callmebot.com/whatsapp.php?phone=${NOTIFY_WHATSAPP}&text=${text}&apikey=${apiKey}`

  await fetch(url).then(async (res) => {
    if (!res.ok) {
      console.error('[waitlist] CallMeBot error:', await res.text())
    } else {
      console.log(`[waitlist] WhatsApp sent for ${displayName}`)
    }
  })
}
