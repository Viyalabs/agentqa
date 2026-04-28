import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const NOTIFY_EMAIL = 'support@viyalabs.com'
const NOTIFY_WHATSAPP = '9600190022'

const RequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().max(100).optional(),
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

  const { email, name } = parsed.data
  const db = getAdminClient()

  // Save to Supabase waitlist table
  const { error: dbError } = await db
    .from('waitlist')
    .insert({ email, name: name ?? null })

  if (dbError) {
    // Unique violation — already on the list
    if (dbError.code === '23505') {
      return NextResponse.json({ message: "You're already on the waitlist!" })
    }
    console.error('[waitlist] DB insert error:', dbError.message)
    return NextResponse.json({ error: 'Failed to join waitlist. Please try again.' }, { status: 500 })
  }

  // Send notifications in parallel (best-effort — don't fail the request if these fail)
  await Promise.allSettled([
    sendEmailNotification(email, name),
    sendWhatsAppNotification(email, name),
  ])

  return NextResponse.json({ message: "You're on the list! We'll email you when Pro launches." })
}

async function sendEmailNotification(email: string, name?: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[waitlist:email] RESEND_API_KEY not set — skipping email')
    return
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'AgentQA <noreply@viyalabs.com>'
  console.log(`[waitlist:email] Sending to ${NOTIFY_EMAIL} from ${from}`)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [NOTIFY_EMAIL],
        subject: `New waitlist signup: ${email}`,
        html: `
          <h2>New AgentQA Pro Waitlist Signup</h2>
          <p><strong>Name:</strong> ${name ?? '—'}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <hr/>
          <p style="color:#888;font-size:12px">Sent by AgentQA — a Viyalabs product</p>
        `,
      }),
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`[waitlist:email] Resend rejected (${res.status}):`, body)
    } else {
      console.log(`[waitlist:email] Sent successfully for ${email}`)
    }
  } catch (err) {
    console.error('[waitlist:email] Network error:', err)
  }
}

async function sendWhatsAppNotification(email: string, name?: string): Promise<void> {
  const apiKey = process.env.CALLMEBOT_API_KEY
  if (!apiKey) {
    console.warn('[waitlist] CALLMEBOT_API_KEY not set — skipping WhatsApp notification')
    return
  }

  const displayName = name ? `${name} (${email})` : email
  const text = encodeURIComponent(
    `🎉 New AgentQA waitlist signup!\nName: ${name ?? '—'}\nEmail: ${email}`
  )

  const url = `https://api.callmebot.com/whatsapp.php?phone=${NOTIFY_WHATSAPP}&text=${text}&apikey=${apiKey}`

  await fetch(url).then(async (res) => {
    if (!res.ok) {
      console.error('[waitlist] CallMeBot error:', await res.text())
    } else {
      console.log(`[waitlist] WhatsApp sent for ${displayName}`)
    }
  })
}
