import { Zap, Wrench, TrendingUp, AlertTriangle, AlertCircle, ArrowRight } from 'lucide-react'

export function ProblemNarrative() {
  return (
    <>
      {/* Why AgentQA Exists */}
      <section className="py-16 border-t border-zinc-800/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/5 text-yellow-400 text-xs font-mono mb-5">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              30M+ developers now use AI coding tools. Bugs ship faster than ever.
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-0 leading-tight">
              AI ships code in minutes.
              <br />
              <span className="text-zinc-500">Testing is still done by hand.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {[
              {
                Icon: TrendingUp,
                color: 'text-yellow-400',
                bg: 'bg-yellow-500/10',
                label: 'Building is 10× faster',
                body: 'AI ships full web apps in under an hour — but the QA process hasn\'t changed since 2005.',
              },
              {
                Icon: Wrench,
                color: 'text-red-400',
                bg: 'bg-red-500/10',
                label: 'QA is still manual',
                body: 'Click every page, maintain scripts that go stale, repeat after every deploy. A process built for 2005.',
              },
              {
                Icon: Zap,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                label: 'Most teams skip it entirely',
                body: 'Can\'t afford a QA team? Bugs reach users. Users churn. Your reputation takes the hit.',
              },
            ].map((item) => (
              <div key={item.label} className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center mb-4`}>
                  <item.Icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <h3 className="text-white font-semibold mb-2">{item.label}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="p-8 sm:p-10 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-white leading-snug">
              AI-generated code needs AI-powered QA.
            </p>
            <p className="text-zinc-400 mt-3 text-lg max-w-xl mx-auto">
              AgentQA is the only QA tool built for the speed at which AI ships code — real browser, zero setup, actionable report in under 2 minutes.
            </p>
            <a
              href="#scan-form"
              className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
            >
              Scan My App Free
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Built for AI-Generated Apps */}
      <AiAppsSection />
    </>
  )
}

const AI_TOOLS = [
  {
    abbr: 'CU',
    name: 'Cursor',
    label: 'AI code editor',
    note: 'Writes production code at speed. AgentQA verifies it works in a real browser.',
  },
  {
    abbr: 'RE',
    name: 'Replit',
    label: 'Cloud IDE + deploy',
    note: 'One-click deploys. AgentQA gives you a QA pass before users hit it.',
  },
  {
    abbr: 'LV',
    name: 'Lovable',
    label: 'AI full-stack builder',
    note: 'Ships full-stack apps in minutes. AgentQA catches what the LLM leaves behind.',
  },
  {
    abbr: 'V0',
    name: 'v0 / Bolt',
    label: 'AI UI generators',
    note: 'Beautiful components, fast. Mobile overflow and JS errors still happen.',
  },
  {
    abbr: '∞',
    name: 'Any framework',
    label: 'React, Next.js, Vue, SvelteKit…',
    note: 'Works with any public URL. If a browser can open it, AgentQA can test it.',
  },
]

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

function AiAppsSection() {
  return (
    <section className="py-16 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: copy */}
          <div>
            <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Built for the new stack</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-tight">
              Apps built with AI<br />break differently
            </h2>
            <p className="text-zinc-400 text-base leading-relaxed mb-6">
              LLMs write plausible-looking code that passes a visual check — then fails silently in production. Mobile viewports overflow. API calls return 401s. JavaScript crashes at runtime. The LLM doesn&apos;t know.
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed mb-8">
              AgentQA is the real-browser QA layer that AI-generated apps never ship with — built for the failure patterns of LLM-written code.
            </p>

            {/* Bug examples */}
            <div className="space-y-3">
              <p className="text-xs text-zinc-600 uppercase tracking-wider font-mono">Real bugs AgentQA catches</p>
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

          {/* Right: tool list */}
          <div className="space-y-3">
            {AI_TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex items-start gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-zinc-300">{tool.abbr}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white text-sm font-semibold">{tool.name}</span>
                    <span className="text-zinc-600 text-xs">{tool.label}</span>
                  </div>
                  <p className="text-zinc-400 text-sm leading-snug">{tool.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
