import { Sparkles, Brain, TrendingUp, Zap } from 'lucide-react'

const PILLARS = [
  {
    icon: Brain,
    title: 'Root cause, not surface message',
    body: 'A 401 on an internal API route is diagnosed differently from a 401 on a third-party service — because the fix is different. Error classification runs on cause, not text.',
  },
  {
    icon: Zap,
    title: 'Fix-ready output',
    body: 'Returns the exact guard, wrapper, or check to add — scoped to the error type and location. Not a documentation page. Not a StackOverflow link.',
  },
  {
    icon: TrendingUp,
    title: 'Pattern library, not a cold start',
    body: 'Each scan contributes to a shared failure pattern library. High-frequency signatures are matched faster and with tighter confidence — a compounding advantage static test suites cannot build.',
  },
]

export function AiMoat() {
  return (
    <section className="py-24 bg-zinc-950/60 border-y border-zinc-800/50 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-600/6 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative">

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono mb-5">
            <Sparkles className="h-3 w-3" />
            Powered by Claude AI
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Not just detection.
            <br />
            <span className="text-blue-400">Root cause. Fix. Pattern-matched.</span>
          </h2>
          <p className="text-base text-zinc-400 max-w-xl mx-auto leading-relaxed mb-3">
            Every issue is analyzed by Claude AI. You get the exact technical reason it broke and a targeted fix — ready to paste into your editor.
          </p>
          <p className="text-base text-zinc-300 max-w-xl mx-auto leading-relaxed">
            Every diagnosis cross-references a shared pattern library built from real failures across all AgentQA scans. Repeated signatures are identified with higher confidence and matched against known fixes — instead of being analyzed cold.
          </p>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/40 overflow-hidden max-w-3xl mx-auto shadow-2xl shadow-black/40 ring-1 ring-blue-500/10">

          {/* Window chrome */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500/70" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <span className="h-3 w-3 rounded-full bg-green-500/70" />
            </div>
            <div className="flex items-center gap-2 ml-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-sm font-mono text-red-400 font-semibold">Critical — Uncaught JS Error</span>
            </div>
            <span className="ml-auto text-xs text-zinc-600 font-mono">dashboard/page.tsx</span>
          </div>

          {/* Error */}
          <div className="px-6 pt-6 pb-4 border-b border-zinc-800/60">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-3">Error detected</p>
            <p className="font-mono text-sm text-zinc-200 bg-zinc-950/70 rounded-lg px-4 py-3 border border-zinc-800 leading-relaxed">
              TypeError: Cannot read properties of undefined (reading &apos;user&apos;)
            </p>
          </div>

          {/* Root cause + fix */}
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800/60">
            <div className="p-6">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-3">Root cause</p>
              <p className="text-sm text-zinc-300 leading-relaxed">
                The auth context is accessed before the session resolves.{' '}
                <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-xs font-mono">useUser()</code>{' '}
                returns{' '}
                <code className="text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">undefined</code>{' '}
                on first render — before the session hydrates on the client.
              </p>
            </div>
            <div className="p-6 bg-green-950/20 border-l border-green-500/10">
              <p className="text-xs text-green-500 uppercase tracking-wider font-mono mb-3">Fix suggestion</p>
              <div className="font-mono text-xs bg-zinc-950/70 rounded-lg px-4 py-3 border border-green-500/20 space-y-1 leading-relaxed">
                <p className="text-zinc-600">{'// Guard before accessing session'}</p>
                <p className="text-green-300">{'if (!user) return <LoadingSpinner />'}</p>
                <p className="text-zinc-600">{'// Then safely use user properties'}</p>
                <p className="text-zinc-400">{'return <Dashboard user={user} />'}</p>
              </div>
              <p className="text-xs text-green-500 mt-3 leading-relaxed">
                Add this guard in every auth-protected component before accessing user properties.
              </p>
            </div>
          </div>

          {/* Learning footer bar */}
          <div className="flex items-center gap-2.5 px-6 py-3 bg-blue-950/20 border-t border-blue-500/10">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
            <p className="text-xs text-blue-400 font-mono">
              Pattern matched from 847 similar auth errors · confidence: high
            </p>
          </div>
        </div>

        {/* Three pillars */}
        <div className="grid sm:grid-cols-3 gap-6 mt-10 max-w-3xl mx-auto">
          {PILLARS.map((item) => (
            <div key={item.title} className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center h-full flex flex-col">
              <item.icon className="h-5 w-5 text-blue-400 mx-auto mb-2" />
              <p className="text-white text-xl font-semibold mb-2">{item.title}</p>
              <p className="text-base text-zinc-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
