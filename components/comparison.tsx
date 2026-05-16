import { CheckCircle2, XCircle } from 'lucide-react'

const ROWS = [
  {
    aspect: 'How to start',
    traditional: 'Write test scripts',
    agentqa: 'Paste a URL',
    highlight: 'key',
    check: false,
  },
  {
    aspect: 'Testing method',
    traditional: 'Manual click-through',
    agentqa: 'Autonomous agent',
    highlight: false,
    check: false,
  },
  {
    aspect: 'Team required',
    traditional: 'QA engineer or team',
    agentqa: 'Zero',
    highlight: false,
    check: true,
  },
  {
    aspect: 'Setup time',
    traditional: 'Days to weeks',
    agentqa: 'Instant',
    highlight: false,
    check: false,
  },
  {
    aspect: 'Test type',
    traditional: 'Static scripts — go stale, need rewrites',
    agentqa: 'Adaptive — retests everything fresh each scan',
    highlight: false,
    check: false,
  },
  {
    aspect: 'Mobile testing',
    traditional: 'Manual device checks',
    agentqa: 'Automatic 375px tests',
    highlight: false,
    check: false,
  },
  {
    aspect: 'Time to results',
    traditional: 'Hours to days',
    agentqa: 'Under 2 minutes',
    highlight: false,
    check: false,
  },
  {
    aspect: 'AI analysis',
    traditional: 'None',
    agentqa: 'Root cause + fix on every issue',
    highlight: false,
    check: true,
  },
  {
    aspect: 'Shareable reports',
    traditional: 'Export + email thread',
    agentqa: 'Single shareable link',
    highlight: false,
    check: false,
  },
  {
    aspect: 'Cost',
    traditional: '$80k–$150k / yr',
    agentqa: 'Free to start',
    highlight: 'cost',
    check: false,
  },
]

export function Comparison() {
  return (
    <section className="py-20 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">The end of manual QA</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Traditional QA vs AgentQA
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl mx-auto">
            QA hasn&apos;t changed in 20 years. AgentQA replaces the entire process with a single URL.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 bg-zinc-900/80 border-b border-zinc-800">
            <div className="py-4 px-6 text-xs text-zinc-500 uppercase tracking-wider font-medium" />
            <div className="py-4 px-6 text-center">
              <span className="text-sm font-semibold text-zinc-500">Traditional QA</span>
            </div>
            <div className="py-4 px-6 text-center bg-blue-500/5 border-l border-blue-500/10">
              <span className="text-sm font-semibold text-blue-400">AgentQA</span>
            </div>
          </div>

          {/* Rows */}
          {ROWS.map((row, i) => {
            const isKey = row.highlight === 'key'
            const isCost = row.highlight === 'cost'
            return (
              <div
                key={row.aspect}
                className={`grid grid-cols-3 border-b last:border-0 ${
                  isKey
                    ? 'bg-blue-500/5 border-b-blue-500/10 border-zinc-800/60'
                    : isCost
                    ? 'border-y border-zinc-700/80 bg-zinc-950/60'
                    : i % 2 === 0
                    ? 'bg-zinc-900/20 border-zinc-800/60'
                    : 'border-zinc-800/60'
                }`}
              >
                <div className={`flex items-center gap-2 ${isCost ? 'py-5 px-6' : 'py-4 px-6'}`}>
                  <span className={`font-medium ${isKey ? 'text-white text-sm' : isCost ? 'text-white text-base' : 'text-zinc-400 text-sm'}`}>
                    {row.aspect}
                  </span>
                  {isKey && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold uppercase tracking-wide">
                      key
                    </span>
                  )}
                </div>

                {/* Traditional column */}
                <div className={`flex items-center justify-center gap-2 ${isCost ? 'py-5 px-6' : 'py-4 px-6'}`}>
                  {row.check && (
                    <XCircle className="h-4 w-4 text-red-500/70 shrink-0" />
                  )}
                  <span className={`text-center ${isCost ? 'text-red-400 font-semibold text-base' : row.check ? 'text-zinc-500 text-sm' : 'text-zinc-600 text-sm'}`}>
                    {row.traditional}
                  </span>
                </div>

                {/* AgentQA column */}
                <div className={`flex items-center justify-center gap-2 bg-blue-500/5 border-l border-blue-500/10 ${isCost ? 'py-5 px-6' : 'py-4 px-6'}`}>
                  {row.check && (
                    <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  )}
                  <span className={`text-center ${isCost ? 'text-green-400 font-semibold text-base' : row.check ? 'text-green-300 text-sm' : 'text-blue-300 text-sm'}`}>
                    {row.agentqa}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom callout */}
        <div className="mt-6 p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
          <p className="text-base text-zinc-400 leading-relaxed">
            A QA engineer costs{' '}
            <span className="text-red-400 font-semibold">$80k–$150k per year</span>{' '}
            and still misses bugs. AgentQA starts at{' '}
            <span className="text-green-400 font-semibold">$0</span>
            {' '}and catches what they miss — broken auth flows, mobile overflows, silent API failures. No hire. No wait.
          </p>
        </div>
      </div>
    </section>
  )
}
