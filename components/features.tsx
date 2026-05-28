import {
  Bug,
  Camera,
  BarChart3,
  Network,
  Smartphone,
  CodeXml,
  ImageOff,
  Timer,
  Eye,
  Search,
  RefreshCw,
  GitBranch,
  TrendingUp,
  Bell,
} from 'lucide-react'

const GROUPS = [
  {
    category: 'Detection',
    eyebrow: 'Every bug, across every page',
    color: 'text-red-400',
    borderColor: 'border-red-500/20',
    items: [
      {
        icon: Bug,
        title: 'Deep Issue Detection',
        description: '404s, 5xx errors, JS crashes, broken forms, broken images — classified as critical, medium, or low.',
        color: 'text-red-400',
        bg: 'bg-red-500/10',
      },
      {
        icon: CodeXml,
        title: 'JS Error Tracking',
        description: 'Captures uncaught exceptions with full stack traces so you know exactly which line crashed.',
        color: 'text-orange-400',
        bg: 'bg-orange-500/10',
      },
      {
        icon: Smartphone,
        title: 'Mobile Responsiveness',
        description: 'Tests every page at 375 px and flags horizontal overflow with side-by-side mobile screenshots.',
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
      },
      {
        icon: ImageOff,
        title: 'Broken Image Detection',
        description: 'Every image that fails to load, across every page, grouped so you see patterns at a glance.',
        color: 'text-pink-400',
        bg: 'bg-pink-500/10',
      },
    ],
  },
  {
    category: 'Debugging',
    eyebrow: 'Everything you need to fix it fast',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    items: [
      {
        icon: Camera,
        title: 'Screenshots & Page Capture',
        description: 'Desktop and mobile screenshots for every page — side-by-side visual diff so you see exactly how each page renders across viewports.',
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
      },
      {
        icon: Network,
        title: 'Network Debugging',
        description: 'Every XHR, fetch, and script request — status codes, response times, failed calls surfaced in one view.',
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
      },
    ],
  },
  {
    category: 'Performance',
    eyebrow: 'Speed and health at a glance',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/20',
    items: [
      {
        icon: BarChart3,
        title: 'QA Score',
        description: 'A 0–100 score weighted by issue severity on every scan — app health as a single number you can track over time.',
        color: 'text-green-400',
        bg: 'bg-green-500/10',
      },
      {
        icon: Timer,
        title: 'Performance Checks',
        description: 'Flags pages that load above 5s and assets over 500 KB — the low-hanging wins to fix before users notice.',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
      },
    ],
  },
  {
    category: 'Accessibility & SEO',
    eyebrow: 'Reach more users, rank higher',
    color: 'text-violet-400',
    borderColor: 'border-violet-500/20',
    items: [
      {
        icon: Eye,
        title: 'Accessibility Checks',
        description: 'Detects images without alt text (WCAG 2.1), missing viewport tags, and broken mobile layouts that exclude screen reader users.',
        color: 'text-violet-400',
        bg: 'bg-violet-500/10',
      },
      {
        icon: Search,
        title: 'SEO Health',
        description: 'Flags missing meta descriptions, H1 issues, and absent Open Graph images that lower search rankings and kill social share previews.',
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/10',
      },
    ],
  },
  {
    category: 'Continuous Monitoring',
    eyebrow: 'Reliability intelligence across every deploy',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/20',
    items: [
      {
        icon: RefreshCw,
        title: 'Recurring Scans',
        description: 'Schedule scans daily, weekly, or on any cadence. Regressions are caught before they accumulate — not discovered by users.',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
      },
      {
        icon: GitBranch,
        title: 'CI/CD Integration',
        description: 'Trigger scans from GitHub Actions, Vercel deploy hooks, or any webhook. QA runs automatically on every merge to main.',
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
      },
      {
        icon: TrendingUp,
        title: 'Regression Tracking',
        description: 'QA score is tracked across every scan. New issues are flagged as regressions — not buried in a flat list of old results.',
        color: 'text-orange-400',
        bg: 'bg-orange-500/10',
      },
      {
        icon: Bell,
        title: 'Slack & Email Alerts',
        description: 'Critical issues trigger instant notifications. The right people know before users do — no dashboard polling required.',
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
      },
    ],
  },
]


export function Features() {
  return (
    <section className="py-20 bg-zinc-950/50 border-y border-zinc-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">What AgentQA tests on every deploy</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Full-stack coverage, zero configuration
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Every deploy triggers desktop and mobile testing across all discovered pages — JS errors, network failures, layout breaks, performance regressions, and more.
          </p>
        </div>

        <div className="space-y-10">
          {GROUPS.map((group) => (
            <div key={group.category}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-medium">
                  {group.category}
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-500">{group.eyebrow}</span>
              </div>
              <div className={`grid sm:grid-cols-2 gap-6 ${group.items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
                {group.items.map((feature) => (
                  <div
                    key={feature.title}
                    className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-200 h-full flex flex-col"
                  >
                    <div className={`w-9 h-9 rounded-lg ${feature.bg} flex items-center justify-center mb-3`}>
                      <feature.icon className={`h-4 w-4 ${feature.color}`} />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-1.5">{feature.title}</h3>
                    <p className="text-base text-zinc-400 leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
