import { AlertTriangle, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

const BUG_EXAMPLES = [
  {
    icon: AlertCircle,
    severity: 'Critical',
    severityColor: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    tool: 'Cursor-generated auth flow',
    error: "TypeError: Cannot read properties of undefined (reading 'user')",
    caught: 'Caught before launch',
  },
  {
    icon: AlertTriangle,
    severity: 'Medium',
    severityColor: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    tool: 'Lovable-generated checkout',
    error: 'Content wider than viewport at 375px — horizontal scroll on mobile',
    caught: 'Caught in 90 seconds',
  },
]

interface ComparisonRow {
  aspect:      string
  traditional: string
  agentqa:     string
  check?:      boolean
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { aspect: 'Setup time',     traditional: 'Days to weeks',                   agentqa: 'Instant — paste a URL'          },
  { aspect: 'Team required',  traditional: 'QA engineer or dedicated team',   agentqa: 'Zero',                check: true },
  { aspect: 'Time to results',traditional: 'Hours to days',                   agentqa: 'Under 2 minutes'                },
  { aspect: 'Mobile testing', traditional: 'Manual device checks',             agentqa: 'Automatic on every scan'        },
  { aspect: 'AI root cause',  traditional: 'None',                             agentqa: 'Every issue explained', check: true },
  { aspect: 'Maintenance',    traditional: 'Scripts go stale — need rewrites', agentqa: 'Nothing to maintain'            },
]

export function WhyAgentQA() {
  return (
    <section className="py-20 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">

        {/* Section header — 2-col so reviewers scan both axes instantly */}
        <div className="grid lg:grid-cols-2 gap-8 items-end mb-12">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Why AgentQA</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
              The reliability gap is growing.
              <br />
              <span className="text-blue-400">AgentQA closes it.</span>
            </h2>
          </div>
          <p className="text-base text-zinc-400 leading-relaxed lg:pb-1">
            AI coding tools ship apps faster than teams can test them. Traditional QA requires test scripts,
            dedicated engineers, and weeks of setup. Most AI-built apps skip QA entirely — and bugs
            reach users instead.
          </p>
        </div>

        {/* Problem card + bug evidence — side by side */}
        <div className="grid lg:grid-cols-2 gap-6 mb-10">

          {/* Left: the core gap */}
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">The gap</p>
            <h3 className="text-lg font-semibold text-white mb-3 leading-snug">
              LLMs generate code that compiles but fails in a real browser
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
              Broken auth flows, mobile viewport overflow, silent API 401s. These only appear when a
              real browser runs the app — no linter, no type checker, no code review catches them.
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              AgentQA runs a real Chrome browser on every deploy, detects failures as they happen,
              and builds a pattern library of your app&apos;s real failure history over time.
            </p>
          </div>

          {/* Right: real detected bugs */}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">What it catches</p>
            <div className="space-y-3">
              {BUG_EXAMPLES.map((bug) => (
                <div key={bug.error} className={`p-4 rounded-xl border ${bug.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <bug.icon className={`h-3.5 w-3.5 ${bug.severityColor}`} />
                      <span className={`text-xs font-semibold ${bug.severityColor}`}>{bug.severity}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{bug.tool}</span>
                  </div>
                  <p className="text-xs font-mono text-zinc-300 mb-1.5 leading-relaxed">{bug.error}</p>
                  <p className="text-xs text-zinc-500">{bug.caught}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compact comparison table */}
        <div className="rounded-2xl border border-zinc-800 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">

              {/* Header */}
              <div className="grid grid-cols-3 bg-zinc-900/80 border-b border-zinc-800">
                <div className="py-3 px-5" />
                <div className="py-3 px-5 text-center">
                  <span className="text-xs font-semibold text-zinc-500">Traditional QA</span>
                </div>
                <div className="py-3 px-5 text-center bg-blue-500/5 border-l border-blue-500/10">
                  <span className="text-xs font-semibold text-blue-400">AgentQA</span>
                </div>
              </div>

              {/* Rows */}
              {COMPARISON_ROWS.map((row, i) => (
                <div
                  key={row.aspect}
                  className={`grid grid-cols-3 border-b last:border-0 ${
                    i % 2 === 0
                      ? 'bg-zinc-900/20 border-zinc-800/60'
                      : 'border-zinc-800/60'
                  }`}
                >
                  <div className="py-3.5 px-5 text-sm font-medium text-zinc-400">{row.aspect}</div>

                  <div className="py-3.5 px-5 flex items-center justify-center gap-1.5">
                    {row.check && <XCircle className="h-3.5 w-3.5 text-red-500/70 shrink-0" />}
                    <span className="text-sm text-zinc-500 text-center">{row.traditional}</span>
                  </div>

                  <div className="py-3.5 px-5 flex items-center justify-center gap-1.5 bg-blue-500/5 border-l border-blue-500/10">
                    {row.check && <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />}
                    <span className={`text-sm text-center ${row.check ? 'text-green-300' : 'text-blue-300'}`}>
                      {row.agentqa}
                    </span>
                  </div>
                </div>
              ))}

            </div>
          </div>
        </div>

        {/* Closing line */}
        <p className="text-center text-base text-zinc-400">
          Static test suites require an engineer to write them, another to maintain them.{' '}
          <span className="text-white font-medium">AgentQA requires a URL.</span>
        </p>

      </div>
    </section>
  )
}
