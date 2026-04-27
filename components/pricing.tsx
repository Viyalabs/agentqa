import { Check, Sparkles } from 'lucide-react'
import { Button } from './ui/button'

const freeTierFeatures = [
  'Up to 10 pages per scan',
  'Full page screenshots',
  'Issue classification (critical/medium/low)',
  'QA score report',
  'Console & network error detection',
  '30-day scan history',
]

const proTierFeatures = [
  'Everything in Free',
  'Unlimited pages per scan',
  'CI/CD integration (GitHub Actions)',
  'Slack & email notifications',
  'Custom test scenarios',
  'API access',
  'Priority support',
]

export function Pricing() {
  return (
    <section className="py-24 px-4" id="pricing">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Simple pricing
          </h2>
          <p className="text-zinc-400">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free tier */}
          <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-1">Free</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <p className="text-sm text-zinc-400 mt-2">Perfect for testing your AI projects</p>
            </div>

            <Button variant="outline" className="w-full mb-8">
              Start testing free
            </Button>

            <ul className="space-y-3">
              {freeTierFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-zinc-300">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro tier */}
          <div className="relative p-8 rounded-2xl border border-blue-500/40 bg-blue-950/20">
            {/* Coming soon overlay */}
            <div className="absolute inset-0 rounded-2xl bg-zinc-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-400 font-medium">
                <Sparkles className="h-4 w-4" />
                Coming Soon
              </div>
              <p className="text-zinc-400 text-sm mt-3">Join the waitlist for early access</p>
              <Button size="sm" className="mt-4">
                Join waitlist
              </Button>
            </div>

            <div className="mb-6 opacity-40">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-white">Pro</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-medium">Popular</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$29</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <p className="text-sm text-zinc-400 mt-2">For teams shipping AI apps</p>
            </div>

            <Button className="w-full mb-8 opacity-40" disabled>
              Get Pro
            </Button>

            <ul className="space-y-3 opacity-40">
              {proTierFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-zinc-300">
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
