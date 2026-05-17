'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
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

type FormState = 'idle' | 'loading' | 'success' | 'error'

export function Pricing() {
  const [formState, setFormState] = useState<FormState>('idle')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setFormState('loading')
    startTransition(async () => {
      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const data = await res.json()
        if (res.ok) {
          setMessage(data.message ?? "You're on the list!")
          setFormState('success')
        } else {
          setMessage(data.error ?? 'Something went wrong. Please try again.')
          setFormState('error')
        }
      } catch {
        setMessage('Could not connect. Please try again.')
        setFormState('error')
      }
    })
  }

  return (
    <section className="py-20 border-t border-zinc-800/40" id="pricing">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Simple pricing</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Start free. Upgrade when you need more.
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-lg mx-auto">
            Free for individual scans. Pro adds CI/CD integration, team seats, API access, and Slack notifications — everything you need to run autonomous QA on every deploy.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free tier */}
          <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-1">Free</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-white">$0</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <p className="text-base text-zinc-400 leading-relaxed mt-2">Full QA report on every scan — no credit card, no expiry</p>
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
                <li key={feature} className="flex items-start gap-3 text-base text-zinc-400">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro tier */}
          <div className="p-8 rounded-2xl border border-blue-500/40 bg-blue-950/20 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-semibold text-white">Pro</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">Coming soon</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-white">$49</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <p className="text-base text-zinc-400 leading-relaxed mt-2">For teams running QA on every deploy</p>
            </div>

            {formState === 'success' ? (
              <div className="mb-8 flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <p className="text-green-300 text-sm">You&apos;re on the list — we&apos;ll reach out to {email}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mb-8 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!email || isPending}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get notified'}
                  </button>
                </div>
                {formState === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {message}
                  </div>
                )}
              </form>
            )}

            <ul className="space-y-3">
              {proTierFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-base text-zinc-400">
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
