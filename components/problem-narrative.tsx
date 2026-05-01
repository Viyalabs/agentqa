import { AlertTriangle, AlertCircle } from 'lucide-react'

const BUG_EXAMPLES = [
  {
    icon: AlertCircle,
    severity: 'Critical',
    severityColor: 'text-red-400',
    bg: 'bg-red-500/8 border-red-500/20',
    tool: 'Cursor-generated auth flow',
    error: "TypeError: Cannot read properties of undefined (reading 'user')",
    caught: 'Caught before launch tweet',
  },
  {
    icon: AlertTriangle,
    severity: 'Medium',
    severityColor: 'text-yellow-400',
    bg: 'bg-yellow-500/8 border-yellow-500/20',
    tool: 'Lovable-generated checkout page',
    error: 'Content wider than viewport at 375px — horizontal scroll on mobile',
    caught: 'Caught in 90 seconds',
  },
]

export function ProblemNarrative() {
  return (
    <section className="py-20 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">

        {/* Macro problem — centered */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/5 text-yellow-400 text-xs font-mono mb-5">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            30M+ developers now ship with AI coding tools
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight">
            AI ships code in minutes.
            <br />
            <span className="text-zinc-500">QA is still done by hand.</span>
          </h2>
        </div>

        {/* The wedge — 2-col */}
        <div className="grid lg:grid-cols-2 gap-12 items-start pt-10 border-t border-zinc-800/40">

          {/* Left: copy */}
          <div>
            <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">The core problem</p>
            <h3 className="text-xl font-semibold text-white mb-4 leading-snug">
              Apps built with AI break differently
            </h3>
            <p className="text-base text-zinc-400 leading-relaxed mb-4">
              LLMs produce code that looks right and breaks at runtime. Auth flows redirect to blank screens. Mobile viewports overflow at 375px. API calls return 401s. The model doesn&apos;t run your app — it doesn&apos;t know.
            </p>
            <p className="text-sm text-zinc-500 leading-relaxed">
              AgentQA is the real-browser QA layer that catches what AI coding tools leave behind. No QA experience required.
            </p>
          </div>

          {/* Right: bug examples */}
          <div className="space-y-3">
            <p className="text-xs text-zinc-600 uppercase tracking-wider font-mono mb-4">Real bugs AgentQA catches</p>
            {BUG_EXAMPLES.map((bug) => (
              <div key={bug.error} className={`p-4 rounded-xl border ${bug.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <bug.icon className={`h-3.5 w-3.5 ${bug.severityColor}`} />
                    <span className={`text-xs font-semibold ${bug.severityColor}`}>{bug.severity}</span>
                  </div>
                  <span className="text-xs text-zinc-600">{bug.tool}</span>
                </div>
                <p className="text-xs font-mono text-zinc-300 mb-1.5">{bug.error}</p>
                <p className="text-xs text-zinc-600">{bug.caught}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
