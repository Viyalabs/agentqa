import {
  Bug,
  Video,
  BarChart3,
  Network,
  Smartphone,
  CodeXml,
  ImageOff,
  Timer,
} from 'lucide-react'

const features = [
  {
    icon: Bug,
    title: 'Deep Issue Detection',
    description: 'Catches 404s, 5xx server errors, JS crashes, broken forms, broken images, and console errors — classified by severity.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: Video,
    title: 'Screenshots & Video Replay',
    description: 'Captures desktop and mobile screenshots for every page, plus video recordings of failing pages for instant debugging.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: BarChart3,
    title: 'QA Score',
    description: 'Every scan produces a 0–100 score weighted by issue severity, so you always know how healthy your app is.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    icon: Network,
    title: 'Network Debugging',
    description: 'Inspect every XHR, fetch, and script request — status codes, response times, sizes, and failed API calls in one tab.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: Smartphone,
    title: 'Mobile Responsiveness',
    description: 'Tests every page at 375 px viewport and flags horizontal overflow, giving you mobile screenshots alongside desktop.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    icon: CodeXml,
    title: 'JS Error Tracking',
    description: 'Captures uncaught exceptions with full stack traces so you can pinpoint exactly which line of code crashed.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    icon: ImageOff,
    title: 'Broken Image Detection',
    description: 'Finds every image that fails to load across all pages, grouped by type so you see patterns at a glance.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
  {
    icon: Timer,
    title: 'Performance Checks',
    description: 'Flags slow page loads and large assets over 500 KB, giving you low-hanging performance wins to fix first.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
]

export function Features() {
  return (
    <section className="py-16 px-4 bg-zinc-950/50 border-y border-zinc-800/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">What we test</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything tested, nothing missed
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Every scan runs a full battery of checks across all discovered pages — desktop and mobile.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
