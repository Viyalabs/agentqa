import {
  Bug,
  Camera,
  BarChart3,
  Network,
  FileWarning,
  Timer,
} from 'lucide-react'

const features = [
  {
    icon: Bug,
    title: 'Issue Detection',
    description: 'Catches 404s, JS crashes, server errors, broken forms, and console errors automatically.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: Camera,
    title: 'Full Screenshots',
    description: 'Captures a viewport screenshot of every tested page for visual verification.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: BarChart3,
    title: 'QA Score',
    description: 'Every scan produces a 0–100 score with a breakdown by severity category.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    icon: Network,
    title: 'Network Monitoring',
    description: 'Detects failed XHR/fetch requests, broken static assets, and unreachable APIs.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: FileWarning,
    title: 'Broken Image Detection',
    description: 'Finds images that fail to render on any page with zero configuration.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Timer,
    title: 'Performance Checks',
    description: 'Flags pages that exceed the 5-second load time threshold as low-severity issues.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
]

export function Features() {
  return (
    <section className="py-24 px-4 bg-zinc-950/50 border-y border-zinc-800/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            What gets tested
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Every scan runs a comprehensive battery of checks across all discovered pages.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
            >
              <div
                className={`w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center mb-4`}
              >
                <feature.icon className={`h-5 w-5 ${feature.color}`} />
              </div>
              <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
