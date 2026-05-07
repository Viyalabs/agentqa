'use client'

import { useState, useTransition } from 'react'
import { Check, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
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

type FormState = 'idle' | 'open' | 'loading' | 'success' | 'error'

export function Pricing() {
  const [formState, setFormState] = useState<FormState>('idle')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
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
          body: JSON.stringify({ email, name: name || undefined }),
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
    <section className="py-16 border-t border-zinc-800/40" id="pricing">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Simple pricing</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Start free. Upgrade when you need more.
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-lg mx-auto">
            A QA engineer costs <span className="text-red-400 font-semibold">$80k–$150k/year</span> and still misses bugs.
            AgentQA is free to start — Pro locks in at <span className="text-green-400 font-semibold">$49/mo</span> during early access.
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
          <div className="relative p-8 rounded-2xl border border-blue-500/40 bg-blue-950/20">
            {/* Overlay */}
            <div className="absolute inset-0 rounded-2xl bg-zinc-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 p-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-400 font-medium mb-3">
                <Sparkles className="h-4 w-4" />
                Early Access
              </div>

              {formState === 'success' ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                  <p className="text-green-300 font-medium text-sm">{message}</p>
                  <p className="text-zinc-500 text-xs">We'll reach out to {email}</p>
                </div>
              ) : formState === 'idle' ? (
                <>
                  <p className="text-zinc-400 text-sm mb-1 text-center font-medium">
                    Launch pricing — limited slots
                  </p>
                  <p className="text-zinc-600 text-xs mb-4 text-center">
                    Lock in <span className="text-green-400 font-medium">$49/mo</span> before we raise prices at public launch
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setFormState('open')}
                  >
                    Get launch pricing
                  </Button>
                </>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="w-full max-w-xs flex flex-col gap-3"
                >
                  <input
                    type="text"
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />

                  {formState === 'error' && (
                    <div className="flex items-center gap-2 text-red-400 text-xs">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {message}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setFormState('idle'); setEmail(''); setName('') }}
                      className="flex-1 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!email || formState === 'loading'}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {formState === 'loading' || isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {formState === 'loading' || isPending ? 'Joining…' : 'Join waitlist'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Background content (blurred) */}
            <div className="mb-6 opacity-40">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-semibold text-white">Pro</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-medium">Early Access</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-white">$49</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <p className="text-base text-zinc-400 leading-relaxed mt-2">For teams shipping AI apps daily</p>
            </div>

            <Button className="w-full mb-8 opacity-40" disabled>
              Get Pro
            </Button>

            <ul className="space-y-3 opacity-40">
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
