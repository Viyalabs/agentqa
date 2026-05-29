import {
  Bug,
  Camera,
  BarChart3,
  Network,
  Smartphone,
  CodeXml,
  RefreshCw,
  GitBranch,
} from 'lucide-react'

const GROUPS = [
  {
    category: 'Detection',
    eyebrow: 'Every issue, across every page',
    items: [
      {
        icon: Bug,
        title: 'Issue Detection',
        description: '404s, JS crashes, broken images, mobile overflow, and failed API calls — classified as critical, medium, or low across every page.',
      },
      {
        icon: CodeXml,
        title: 'JS Error Tracking',
        description: 'Uncaught exceptions captured with full stack traces and matched against known failure signatures for instant pattern recognition.',
      },
      {
        icon: Smartphone,
        title: 'Mobile Testing',
        description: 'Every page tested at 375px. Horizontal overflow flagged with side-by-side desktop and mobile screenshots on every scan.',
      },
      {
        icon: BarChart3,
        title: 'QA Score',
        description: 'A 0–100 reliability score weighted by issue severity. One number to track app health across every deploy over time.',
      },
    ],
  },
  {
    category: 'Debugging',
    eyebrow: 'Everything you need to fix fast',
    items: [
      {
        icon: Camera,
        title: 'Screenshots & Capture',
        description: 'Desktop and mobile screenshots for every page on every scan. Visual evidence attached to every issue detected.',
      },
      {
        icon: Network,
        title: 'Network Analysis',
        description: 'Every API call, fetch, and script request — status codes, response times, and failures surfaced in one view.',
      },
    ],
  },
  {
    category: 'Continuous Monitoring',
    eyebrow: 'Reliability across every deploy',
    items: [
      {
        icon: RefreshCw,
        title: 'Recurring Scans',
        description: 'Schedule scans daily, weekly, or after every deploy. Regressions are caught before they accumulate into user complaints.',
      },
      {
        icon: GitBranch,
        title: 'CI/CD Integration',
        description: 'Trigger from GitHub Actions, Vercel deploy hooks, or any webhook. Reliability intelligence runs on every merge to main.',
      },
    ],
  },
]

export function Features() {
  return (
    <section className="py-20 bg-zinc-950/50 border-y border-zinc-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">What gets tested on every deploy</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Full-stack coverage, zero configuration
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Real browser testing across every discovered page — desktop and mobile — on every deploy.
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
                <span className="text-xs text-zinc-600">{group.eyebrow}</span>
              </div>
              <div className={`grid sm:grid-cols-2 gap-6 ${group.items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
                {group.items.map((feature) => (
                  <div
                    key={feature.title}
                    className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-200 h-full flex flex-col"
                  >
                    <div className="w-9 h-9 rounded-lg bg-zinc-800/60 flex items-center justify-center mb-4">
                      <feature.icon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
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
