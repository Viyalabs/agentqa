import {
  Bug,
  Video,
  BarChart3,
  Network,
  Smartphone,
  CodeXml,
  ImageOff,
  Timer,
  Sparkles,
  Wrench,
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
        icon: Video,
        title: 'Screenshots & Video Replay',
        description: 'Desktop and mobile screenshots for every page, plus video recordings of failures.',
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
      },
      {
        icon: Network,
        title: 'Network Debugging',
        description: 'Every XHR, fetch, and script request — status codes, response times, failed calls in one tab.',
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
      },
      {
        icon: BarChart3,
        title: 'QA Score',
        description: 'A 0–100 score weighted by severity on every scan, so app health is always a single number.',
        color: 'text-green-400',
        bg: 'bg-green-500/10',
      },
      {
        icon: Timer,
        title: 'Performance Checks',
        description: 'Flags pages that load above 5s and assets over 500 KB — low-hanging wins to fix first.',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
      },
    ],
  },
]

function AIInsightsBlock() {
  return (
    <div className="mt-12 rounded-2xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
      <div className="px-6 py-5 border-b border-blue-500/10 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-blue-400" />
        <div>
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase">AI Intelligence — Live</p>
          <p className="text-white font-semibold text-sm mt-0.5">Not just detection — explanation and fix</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-blue-500/10">
        {/* Left: AI analysis items */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="text-white text-sm font-semibold mb-0.5">AI Root Cause Analysis</div>
              <div className="text-zinc-400 text-sm leading-relaxed">
                Every issue is analyzed by Claude AI — not just what broke, but the technical reason it happened.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <Wrench className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <div className="text-white text-sm font-semibold mb-0.5">Fix Suggestions</div>
              <div className="text-zinc-400 text-sm leading-relaxed">
                Actionable, developer-ready steps to resolve each issue — not generic advice.
              </div>
            </div>
          </div>
        </div>

        {/* Right: sample AI output */}
        <div className="p-6">
          <div className="text-xs text-zinc-600 font-mono uppercase tracking-wider mb-3">Sample AI output</div>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs text-zinc-500 font-mono">Critical · Uncaught JS Error</span>
              </div>
              <p className="text-xs text-zinc-400 mb-2">TypeError: Cannot read properties of undefined (reading &apos;user&apos;)</p>
              <div className="text-xs text-zinc-600 font-medium mb-0.5">Root cause</div>
              <p className="text-xs text-zinc-400 mb-2">The auth context is accessed before the session resolves. <code className="text-blue-400">useUser()</code> returns undefined on first render.</p>
              <div className="text-xs text-green-600 font-medium mb-0.5">Fix</div>
              <p className="text-xs text-green-400">Add a loading guard: <code>if (!user) return null</code> before accessing user properties in your auth-protected components.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Features() {
  return (
    <section className="py-16 px-4 bg-zinc-950/50 border-y border-zinc-800/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">What we test</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything tested. Nothing missed.
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Every scan runs a full battery of checks across all discovered pages — desktop and mobile — then AI explains what it found.
          </p>
        </div>

        <div className="space-y-10">
          {GROUPS.map((group) => (
            <div key={group.category}>
              <div className="flex items-center gap-3 mb-5">
                <span className={`text-xs font-mono font-bold uppercase tracking-widest ${group.color}`}>
                  {group.category}
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-600">{group.eyebrow}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {group.items.map((feature) => (
                  <div
                    key={feature.title}
                    className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg ${feature.bg} flex items-center justify-center mb-3`}>
                      <feature.icon className={`h-4 w-4 ${feature.color}`} />
                    </div>
                    <h3 className="font-semibold text-white text-sm mb-1.5">{feature.title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <AIInsightsBlock />
      </div>
    </section>
  )
}
