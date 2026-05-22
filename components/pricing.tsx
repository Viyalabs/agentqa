'use client'

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
              <h3 className="text-xl font-semibold text-white mb-1">Pro</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-semibold text-white">$49</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">For teams running QA on every deploy</p>
            </div>

            <a
              href="mailto:info@viyalabs.com?subject=AgentQA Pro Access"
              className="w-full mb-8 flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              Get early access
            </a>

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
