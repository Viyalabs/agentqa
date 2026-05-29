/**
 * TeamFlow demo landing page — seeded issues for AgentQA DemoScan.
 *
 * Guaranteed findings on this page:
 *   1. Uncaught TypeError (Critical −20)     — DemoErrorTrigger fires at 1.5s
 *   2. Failed API request (Medium −8)        — DemoNetworkError → /api/teamflow/activity
 *   3. Hero image — no alt attribute (Medium −8)
 *   4. 4 team avatars — no alt, broken src (Medium −8)
 *   5. Missing meta description (Low −2)
 *   6. Missing OG image (Low −2)
 *
 * Expected score: ~52 / Fair
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { DemoErrorTrigger } from './demo-error-trigger'
import { DemoNetworkError } from './demo-network-error'

export const metadata: Metadata = {
  title: 'TeamFlow — Projects that actually ship',
  description: '',           // intentionally empty — missing meta description
  robots: { index: false, follow: false },
}

const FEATURES = [
  {
    title: 'Task management',
    desc:  'Create, assign, and track tasks across projects. Drag-and-drop boards with real-time sync.',
    icon:  '📋',
  },
  {
    title: 'Team collaboration',
    desc:  'Comment threads, @mentions, and shared task views. Everyone stays aligned automatically.',
    icon:  '👥',
  },
  {
    title: 'Progress tracking',
    desc:  'Burndown charts, velocity tracking, and sprint retrospectives built into every project.',
    icon:  '📈',
  },
]

const TEAM = [
  { name: 'Sarah Chen',    role: 'Product Lead',       avatar: '/demo-assets/avatar-sarah.jpg'  },
  { name: 'James Miller',  role: 'Engineering',         avatar: '/demo-assets/avatar-james.jpg'  },
  { name: 'Priya Nair',    role: 'Design',              avatar: '/demo-assets/avatar-priya.jpg'  },
  { name: 'Tom Okafor',    role: 'Customer Success',    avatar: '/demo-assets/avatar-tom.jpg'    },
]

export default function DemoAppPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Fires uncaught TypeError 1.5s post-load */}
      <DemoErrorTrigger />
      {/* Fires failed fetch to non-existent endpoint */}
      <DemoNetworkError endpoint="/api/teamflow/activity" />

      {/* Nav — links drive BFS crawl to /dashboard and /pricing */}
      <header className="border-b border-gray-100 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">TeamFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-500">
            <Link href="/demo-app/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
            <Link href="/demo-app/pricing"   className="hover:text-gray-900 transition-colors">Pricing</Link>
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/demo-app/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/demo-app/pricing"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Now in public beta
              </div>
              <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-5">
                Projects that<br />
                <span className="text-blue-600">actually ship.</span>
              </h1>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">
                TeamFlow keeps your team aligned from kickoff to launch — task boards, sprint planning,
                and progress tracking in one place.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/demo-app/pricing"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Start free trial
                </Link>
                <Link
                  href="/demo-app/dashboard"
                  className="border border-gray-200 hover:border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  See the app →
                </Link>
              </div>
              <p className="text-xs text-gray-400 mt-4">No credit card required · Free for up to 3 projects</p>
            </div>

            {/* Hero image — broken src, no alt attribute */}
            <div className="relative">
              <img
                src="/demo-assets/hero-screenshot.png"
                className="w-full rounded-2xl shadow-2xl border border-gray-100"
              />
              <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
                <div className="text-xs text-gray-500">Projects completed</div>
                <div className="text-2xl font-bold text-gray-900">1,284</div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="border-y border-gray-100 bg-gray-50 py-10">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-3 gap-8 text-center">
              {[
                { value: '12,000+', label: 'Teams using TeamFlow'  },
                { value: '98%',     label: 'On-time delivery rate' },
                { value: '4.9 / 5', label: 'Average team rating'   },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-3xl font-bold text-gray-900 mb-1">{s.value}</div>
                  <div className="text-sm text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-6 py-20" id="features">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything your team needs</h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Built for modern software teams who ship fast and need to stay coordinated without the overhead.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 bg-white hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Team section — 4 broken images with no alt attributes */}
        <section className="bg-gray-50 border-t border-gray-100 py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Meet the team</h2>
              <p className="text-gray-500">The people building TeamFlow.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {TEAM.map((member) => (
                <div key={member.name} className="text-center p-6 bg-white rounded-2xl border border-gray-100">
                  {/* Broken image + missing alt — two detectable issues per entry */}
                  <img
                    src={member.avatar}
                    className="w-16 h-16 rounded-full bg-gray-200 mx-auto mb-4 object-cover"
                  />
                  <div className="font-semibold text-gray-900 text-sm">{member.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{member.role}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to ship faster?</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Join thousands of teams using TeamFlow to deliver projects on time, every time.
          </p>
          <Link
            href="/demo-app/pricing"
            className="inline-flex bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-semibold text-sm transition-colors"
          >
            Start your free trial
          </Link>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400">
          <span>© 2026 TeamFlow — Demo app for <a href="/" className="hover:text-gray-600 transition-colors">AgentQA</a> testing</span>
          <div className="flex items-center gap-4">
            <Link href="/demo-app/dashboard" className="hover:text-gray-600 transition-colors">Dashboard</Link>
            <Link href="/demo-app/pricing"   className="hover:text-gray-600 transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
