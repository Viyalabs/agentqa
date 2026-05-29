/**
 * TeamFlow pricing page — seeded issues for AgentQA DemoScan.
 *
 * Guaranteed findings on this page:
 *   1. Broken link to /demo-app/checkout (Medium −8)   — 404 when BFS crawls it
 *   2. Feature comparison icons — no alt (Medium −8)   — 12 <img> tags without alt
 *   3. No H1 tag (Low −2)                              — only h2/h3 used
 *
 * Expected score: ~82 / Good
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — TeamFlow',
  description: '',
  robots: { index: false, follow: false },
}

const PLANS = [
  {
    name:    'Starter',
    price:   'Free',
    period:  '',
    desc:    'For small teams getting started.',
    cta:     'Get started free',
    ctaHref: '/demo-app/dashboard',
    highlight: false,
    features: [
      'Up to 3 projects',
      '5 team members',
      'Basic task boards',
      '1 GB storage',
      'Email support',
    ],
  },
  {
    name:    'Pro',
    price:   '$18',
    period:  '/user/month',
    desc:    'For growing teams that ship fast.',
    cta:     'Start free trial',
    ctaHref: '/demo-app/checkout',   // Intentionally 404 — BFS crawls this link
    highlight: true,
    features: [
      'Unlimited projects',
      'Unlimited team members',
      'Advanced boards + sprints',
      'Analytics & reporting',
      'Priority support',
      'CI/CD integrations',
    ],
  },
  {
    name:    'Enterprise',
    price:   'Custom',
    period:  '',
    desc:    'For large organisations with custom needs.',
    cta:     'Contact sales',
    ctaHref: '/demo-app/dashboard',
    highlight: false,
    features: [
      'Everything in Pro',
      'SSO / SAML',
      'Custom contracts & SLA',
      'Dedicated support',
      'On-premise option',
      'Audit logs',
    ],
  },
]

// Feature comparison — images used as check icons, all missing alt attributes
const COMPARISON = [
  { feature: 'Task boards',          starter: true,  pro: true,  enterprise: true  },
  { feature: 'Sprint planning',      starter: false, pro: true,  enterprise: true  },
  { feature: 'Burndown charts',      starter: false, pro: true,  enterprise: true  },
  { feature: 'Custom workflows',     starter: false, pro: true,  enterprise: true  },
  { feature: 'API access',           starter: false, pro: true,  enterprise: true  },
  { feature: 'SSO / SAML',           starter: false, pro: false, enterprise: true  },
  { feature: 'SLA guarantee',        starter: false, pro: false, enterprise: true  },
]

function ComparisonIcon({ enabled }: { enabled: boolean }) {
  if (enabled) {
    // Broken image + no alt — detected as broken_image + missing_alt
    return (
      <img
        src="/demo-assets/icon-check.svg"
        className="w-5 h-5 mx-auto"
      />
    )
  }
  return <span className="text-gray-200 text-lg mx-auto block text-center">—</span>
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/demo-app" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <span className="font-semibold">TeamFlow</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-500">
            <Link href="/demo-app"           className="hover:text-gray-900 transition-colors">Home</Link>
            <Link href="/demo-app/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
            <Link href="/demo-app/pricing"   className="text-blue-600 font-medium">Pricing</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">

        {/* Page header — no H1 intentionally */}
        <div className="text-center mb-14">
          {/* h2 used instead of h1 — missing H1 detection */}
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-500 text-lg max-w-lg mx-auto">
            Start free. Scale when you need to. No hidden fees.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 flex flex-col ${
                plan.highlight
                  ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {plan.highlight && (
                <div className="text-xs font-semibold text-blue-600 bg-blue-100 rounded-full px-3 py-1 self-start mb-4">
                  Most popular
                </div>
              )}
              <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                {plan.period && <span className="text-sm text-gray-500 mb-1">{plan.period}</span>}
              </div>
              <p className="text-sm text-gray-500 mb-6">{plan.desc}</p>

              <Link
                href={plan.ctaHref}
                className={`block text-center py-3 rounded-xl font-semibold text-sm mb-6 transition-colors ${
                  plan.highlight
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'border border-gray-300 hover:border-gray-400 text-gray-700'
                }`}
              >
                {plan.cta}
              </Link>

              <ul className="space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 text-xs flex items-center justify-center shrink-0 font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Comparison table — check icons use broken images with no alt */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Full feature comparison</h2>
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-gray-500 font-medium">Feature</th>
                    <th className="text-center px-6 py-4 text-gray-700 font-semibold">Starter</th>
                    <th className="text-center px-6 py-4 text-blue-700 font-semibold bg-blue-50">Pro</th>
                    <th className="text-center px-6 py-4 text-gray-700 font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5 text-gray-700">{row.feature}</td>
                      <td className="px-6 py-3.5 text-center"><ComparisonIcon enabled={row.starter} /></td>
                      <td className="px-6 py-3.5 text-center bg-blue-50/50"><ComparisonIcon enabled={row.pro} /></td>
                      <td className="px-6 py-3.5 text-center"><ComparisonIcon enabled={row.enterprise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Questions?</h2>
          <p className="text-gray-500 text-sm">
            Email us at{' '}
            <a href="mailto:hello@teamflow.app" className="text-blue-600 hover:underline">hello@teamflow.app</a>
            {' '}or check the{' '}
            <Link href="/demo-app/dashboard" className="text-blue-600 hover:underline">docs</Link>.
          </p>
        </div>

      </main>

      <footer className="border-t border-gray-100 mt-20 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-gray-400">
          TeamFlow — Demo app for <a href="/" className="hover:text-gray-600 transition-colors">AgentQA</a> testing
        </div>
      </footer>
    </div>
  )
}
