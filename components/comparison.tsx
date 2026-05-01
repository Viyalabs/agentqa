const ROWS = [
  {
    aspect: 'How to start',
    traditional: 'Write test scripts',
    agentqa: 'Paste a URL',
    highlight: 'key',
  },
  {
    aspect: 'Testing method',
    traditional: 'Manual click-through',
    agentqa: 'Autonomous agent',
    highlight: false,
  },
  {
    aspect: 'Team required',
    traditional: 'QA engineer or team',
    agentqa: 'Zero',
    highlight: false,
  },
  {
    aspect: 'Setup time',
    traditional: 'Days to weeks',
    agentqa: 'Instant',
    highlight: false,
  },
  {
    aspect: 'Test type',
    traditional: 'Static scripts — go stale, need rewrites',
    agentqa: 'Adaptive — retests everything fresh each scan',
    highlight: false,
  },
  {
    aspect: 'Mobile testing',
    traditional: 'Manual device checks',
    agentqa: 'Automatic 375px tests',
    highlight: false,
  },
  {
    aspect: 'Time to results',
    traditional: 'Hours to days',
    agentqa: 'Under 2 minutes',
    highlight: false,
  },
  {
    aspect: 'AI analysis',
    traditional: 'None',
    agentqa: 'Root cause + fix on every issue',
    highlight: false,
  },
  {
    aspect: 'Shareable reports',
    traditional: 'Export + email thread',
    agentqa: 'Single shareable link',
    highlight: false,
  },
  {
    aspect: 'Cost',
    traditional: '$80k–$150k / yr',
    agentqa: 'Free to start',
    highlight: 'cost',
  },
]

export function Comparison() {
  return (
    <section className="py-16 px-4 border-t border-zinc-800/40">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Why AgentQA</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Traditional QA vs AgentQA
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
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
                className={`grid grid-cols-3 border-b border-zinc-800/60 last:border-0 ${
                  isKey
                    ? 'bg-blue-500/5 border-b-blue-500/10'
                    : isCost
                    ? ''
                    : i % 2 === 0
                    ? 'bg-zinc-900/20'
                    : ''
                }`}
              >
                <div className="py-4 px-6 flex items-center gap-2">
                  <span className={`text-sm font-medium ${isKey ? 'text-white' : 'text-zinc-400'}`}>
                    {row.aspect}
                  </span>
                  {isKey && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold uppercase tracking-wide">
                      key
                    </span>
                  )}
                </div>
                <div className="py-4 px-6 flex items-center justify-center">
                  <span className={`text-sm text-center ${isCost ? 'text-red-400 font-semibold' : 'text-zinc-600'}`}>
                    {row.traditional}
                  </span>
                </div>
                <div className="py-4 px-6 flex items-center justify-center bg-blue-500/5 border-l border-blue-500/10">
                  <span className={`text-sm font-medium text-center ${isCost ? 'text-green-400 font-semibold' : 'text-blue-300'}`}>
                    {row.agentqa}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom callout */}
        <div className="mt-6 p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
          <p className="text-zinc-300 text-sm font-medium">
            A QA engineer costs{' '}
            <span className="text-red-400 font-semibold">$80k–$150k per year</span>{' '}
            and still misses bugs.
            AgentQA finds them in{' '}
            <span className="text-green-400 font-semibold">under 2 minutes</span>, free to start.
          </p>
        </div>
      </div>
    </section>
  )
}
