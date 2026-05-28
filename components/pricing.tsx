'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from './ui/button'

const freeTierFeatures = [
  'Up to 5 pages per scan',
  'Full page screenshots — desktop & mobile',
  'Issue classification (critical / medium / low)',
  'AI root cause analysis + fix suggestions',
  'Overall health score + per-page breakdown',
  'Console, JS, and network error detection',
  'Permanent shareable report link',
]

const proTierFeatures = [
  'Everything in Free',
  'Unlimited pages per scan',
  'CI/CD integration (GitHub Actions / Vercel)',
  'Slack & email notifications',
  'API access + webhook triggers',
  'Team seat sharing',
  'Priority support',
]

function ProWaitlistForm() {
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json() as { message?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong — please try again.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400 mb-8">
        ✓ You&apos;re on the list — we&apos;ll email you when Pro launches.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="flex gap-2">
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <Button type="submit" disabled={loading} size="sm" className="shrink-0">
          {loading ? 'Joining…' : 'Join waitlist'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </form>
  )
}

export function Pricing() {
  return (
    <section className="py-20 border-t border-zinc-800/40" id="pricing">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Simple pricing</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Start free. Upgrade when you ship.
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-lg mx-auto">
            Free for individual scans. Pro adds CI/CD integration, team seats, API access, and Slack notifications — autonomous QA on every deploy.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

          {/* Free tier */}
          <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-1">Free</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-semibold text-white">$0</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">Full QA report on every scan — no credit card, no expiry</p>
            </div>

            <Button
              variant="outline"
              className="w-full mb-8"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>('#scan-form input[type="text"]')
                input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                input?.focus()
              }}
            >
              Scan My App Free
            </Button>

            <ul className="space-y-3">
              {freeTierFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-zinc-400">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro tier */}
          <div className="p-8 rounded-2xl border border-blue-500/40 bg-blue-950/20 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xl font-semibold text-white">Pro</h3>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
                  Coming soon
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-semibold text-white">$49</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                For teams running QA on every deploy — join the waitlist to be notified at launch.
              </p>
            </div>

            <ProWaitlistForm />

            <ul className="space-y-3">
              {proTierFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-zinc-400">
                  <Check className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  )
}
