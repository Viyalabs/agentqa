/**
 * Intentionally imperfect demo page — seeded issues for AgentQA DemoScan feature.
 *
 * Guaranteed findings:
 *   1. Uncaught JS TypeError (Critical -20)      — DemoErrorTrigger, fires 1.5s after load
 *   2. Broken images, no alt attribute (Medium)   — /demo-assets/* paths don't exist
 *   3. Mobile layout overflow (Medium)            — fixed 960px wide table
 *   4. 404 internal links (Medium)               — BFS crawl follows /demo-app/settings
 *
 * Expected QA score: ~50–65  (Fair)
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { DemoErrorTrigger } from './demo-error-trigger'

// Intentionally thin metadata — no description, no og:image
export const metadata: Metadata = {
  title: 'Dashboard — TeamFlow',
  robots: { index: false, follow: false },
}

const TEAM = [
  { name: 'Alex Rivera',  role: 'Engineering',  avatar: '/demo-assets/avatar-1.jpg' },
  { name: 'Sam Chen',     role: 'Product',       avatar: '/demo-assets/avatar-2.jpg' },
  { name: 'Jordan Kim',   role: 'Design',        avatar: '/demo-assets/avatar-3.jpg' },
]

const METRICS = [
  { label: 'Active Users',    value: '1,284', change: '+12%'  },
  { label: 'Monthly Revenue', value: '$4,820', change: '+8%'  },
  { label: 'Open Tickets',    value: '23',    change: '-3%'  },
]

const EVENTS = [
  { id: 1, user: 'alex@example.com',  action: 'Created project',    time: '2 min ago'  },
  { id: 2, user: 'sam@example.com',   action: 'Updated billing',    time: '14 min ago' },
  { id: 3, user: 'jordan@example.com',action: 'Invited team member','time': '1 hr ago' },
  { id: 4, user: 'alex@example.com',  action: 'Deployed v2.1.0',    time: '3 hr ago'   },
  { id: 5, user: 'sam@example.com',   action: 'Closed ticket #441', time: 'Yesterday'  },
]

export default function DemoAppPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Fires uncaught TypeError 1.5s after load — caught by page.on('pageerror') */}
      <DemoErrorTrigger />

      {/* Nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-gray-900 text-lg">TeamFlow</span>
          <nav className="hidden md:flex items-center gap-4 text-sm text-gray-500">
            <a href="/demo-app" className="text-gray-900 font-medium">Dashboard</a>
            {/* Points to non-existent page — BFS crawler finds 404 */}
            <Link href="/demo-app/settings" className="hover:text-gray-700">Settings</Link>
            <Link href="/demo-app/reports" className="hover:text-gray-700">Reports</Link>
          </nav>
        </div>
        {/* Broken image + missing alt — broken_image + missing_alt detection */}
        <img src="/demo-assets/user-avatar.jpg" className="w-8 h-8 rounded-full border border-gray-200" />
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        <div className="mb-8">
          <p className="text-sm text-gray-500">Welcome back, Alex</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">Dashboard</p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {METRICS.map((m) => (
            <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">{m.label}</p>
              <p className="text-2xl font-bold text-gray-900">{m.value}</p>
              <p className={`text-xs mt-1 ${m.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                {m.change} vs last month
              </p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-[1fr_280px] gap-6">

          {/* Activity table — fixed 960px min-width causes mobile overflow */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-900">Recent Activity</p>
            </div>
            {/* Intentionally fixed-width — mobile layout overflow detection */}
            <div style={{ minWidth: '960px' }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">User</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Action</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Time</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map((e) => (
                    <tr key={e.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-700">{e.user}</td>
                      <td className="px-5 py-3 text-gray-900">{e.action}</td>
                      <td className="px-5 py-3 text-gray-500">{e.time}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Team sidebar — broken images, no alt attributes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="font-semibold text-gray-900 mb-4">Team</p>
            <div className="space-y-4">
              {TEAM.map((member) => (
                <div key={member.name} className="flex items-center gap-3">
                  {/* Broken image + no alt — two detectable issues per entry */}
                  <img src={member.avatar} className="w-9 h-9 rounded-full bg-gray-200" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100">
              {/* Points to non-existent page */}
              <Link
                href="/demo-app/invite"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Invite team member
              </Link>
            </div>
          </div>

        </div>
      </main>

      <footer className="border-t border-gray-200 mt-12 px-6 py-6 text-center text-xs text-gray-400">
        <p>TeamFlow — demo app for <a href="/" className="text-gray-500">AgentQA</a> testing</p>
      </footer>
    </div>
  )
}
