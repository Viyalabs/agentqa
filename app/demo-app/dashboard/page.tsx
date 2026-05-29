/**
 * TeamFlow dashboard page — seeded issues for AgentQA DemoScan.
 *
 * Guaranteed findings on this page:
 *   1. Failed API request (Medium −8)   — DemoNetworkError → /api/teamflow/metrics
 *   2. Mobile layout overflow (Medium −8) — fixed 960px activity table
 *   3. Chart images — no alt attribute (Medium −8)
 *
 * Expected score: ~76 / Good-Fair
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { DemoNetworkError } from '../demo-network-error'

export const metadata: Metadata = {
  title: 'Dashboard — TeamFlow',
  description: '',
  robots: { index: false, follow: false },
}

const PROJECTS = [
  { name: 'Website Redesign',   progress: 72, status: 'On track',  color: 'bg-blue-500'   },
  { name: 'Mobile App v2',      progress: 45, status: 'At risk',   color: 'bg-yellow-400' },
  { name: 'API Integration',    progress: 91, status: 'On track',  color: 'bg-green-500'  },
  { name: 'Analytics Dashboard',progress: 18, status: 'Behind',    color: 'bg-red-400'    },
]

const ACTIVITY = [
  { id: 1, user: 'sarah@teamflow.app',  action: 'Completed task: "Design system tokens"',  time: '3 min ago',  project: 'Website Redesign'    },
  { id: 2, user: 'james@teamflow.app',  action: 'Created PR #441: Auth middleware refactor', time: '18 min ago', project: 'API Integration'       },
  { id: 3, user: 'priya@teamflow.app',  action: 'Updated wireframes in Figma',              time: '1 hr ago',   project: 'Mobile App v2'         },
  { id: 4, user: 'tom@teamflow.app',    action: 'Closed ticket: "Onboarding email delay"',  time: '2 hr ago',   project: 'Analytics Dashboard'   },
  { id: 5, user: 'sarah@teamflow.app',  action: 'Scheduled sprint retrospective',           time: '4 hr ago',   project: 'Website Redesign'      },
  { id: 6, user: 'james@teamflow.app',  action: 'Merged PR #438: Database schema update',   time: 'Yesterday',  project: 'API Integration'       },
]

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Fires failed fetch to non-existent metrics endpoint */}
      <DemoNetworkError endpoint="/api/teamflow/metrics" />

      {/* Sidebar + main layout */}
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden md:flex w-56 flex-col bg-white border-r border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <span className="font-semibold text-sm">TeamFlow</span>
          </div>
          <nav className="space-y-1 text-sm">
            {[
              { label: 'Dashboard',  active: true  },
              { label: 'Projects',   active: false },
              { label: 'My Tasks',   active: false },
              { label: 'Calendar',   active: false },
              { label: 'Reports',    active: false },
            ].map((item) => (
              <div
                key={item.label}
                className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  item.active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </div>
            ))}
          </nav>
          <div className="mt-auto pt-4 border-t border-gray-100">
            <Link href="/demo-app/pricing" className="block px-3 py-2 text-xs text-blue-600 font-medium hover:underline">
              Upgrade to Pro →
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 p-6 overflow-auto">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">Thursday, May 29 · Q2 Sprint 4</p>
            </div>
            <Link
              href="/demo-app/pricing"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            >
              New project
            </Link>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Active projects', value: '12',  change: '+2 this week'    },
              { label: 'Tasks completed', value: '84',  change: '+12 vs last week' },
              { label: 'Team velocity',   value: '94%', change: '↑ 3% vs avg'     },
              { label: 'Open blockers',   value: '3',   change: '−1 resolved today'},
            ].map((m) => (
              <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                <div className="text-2xl font-bold text-gray-900">{m.value}</div>
                <div className="text-xs text-gray-400 mt-1">{m.change}</div>
              </div>
            ))}
          </div>

          {/* Charts row — images without alt attributes */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-sm font-semibold text-gray-900 mb-3">Sprint velocity</div>
              {/* Broken image + no alt — detected as broken_image + missing_alt */}
              <img src="/demo-assets/chart-velocity.png" className="w-full h-36 object-cover bg-gray-50 rounded-lg" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-sm font-semibold text-gray-900 mb-3">Task completion</div>
              {/* Broken image + no alt */}
              <img src="/demo-assets/chart-completion.png" className="w-full h-36 object-cover bg-gray-50 rounded-lg" />
            </div>
          </div>

          {/* Project progress */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <div className="text-sm font-semibold text-gray-900 mb-4">Project progress</div>
            <div className="space-y-4">
              {PROJECTS.map((p) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-700">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.status === 'On track' ? 'bg-green-50 text-green-700'
                        : p.status === 'At risk' ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-red-50 text-red-700'
                      }`}>{p.status}</span>
                      <span className="text-xs text-gray-400">{p.progress}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity table — fixed 960px min-width → mobile overflow detection */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-semibold text-gray-900 mb-4">Recent activity</div>
            {/* Intentionally fixed width — triggers mobile_overflow at 375px */}
            <div style={{ minWidth: '960px' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="pb-3 text-xs font-medium text-gray-500 pr-8">User</th>
                    <th className="pb-3 text-xs font-medium text-gray-500 pr-8">Action</th>
                    <th className="pb-3 text-xs font-medium text-gray-500 pr-8">Project</th>
                    <th className="pb-3 text-xs font-medium text-gray-500">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ACTIVITY.map((a) => (
                    <tr key={a.id}>
                      <td className="py-3 pr-8 text-gray-600 font-mono text-xs">{a.user}</td>
                      <td className="py-3 pr-8 text-gray-800">{a.action}</td>
                      <td className="py-3 pr-8 text-gray-500">{a.project}</td>
                      <td className="py-3 text-gray-400 text-xs">{a.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
