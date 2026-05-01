const ROWS = [
  { aspect: 'How to start',       traditional: 'Write test scripts',          agentqa: 'Paste a URL' },
  { aspect: 'Testing method',     traditional: 'Manual click-through',        agentqa: 'Autonomous agent' },
  { aspect: 'Team required',      traditional: 'QA engineer or team',         agentqa: 'Zero' },
  { aspect: 'Setup time',         traditional: 'Days to weeks',               agentqa: 'Instant' },
  { aspect: 'Test maintenance',   traditional: 'Scripts go stale, need updates', agentqa: 'None — reruns every scan' },
  { aspect: 'Mobile testing',     traditional: 'Manual device checks',        agentqa: 'Automatic 375px tests' },
  { aspect: 'Time to results',    traditional: 'Hours to days',               agentqa: 'Under 2 minutes' },
  { aspect: 'Shareable reports',  traditional: 'Export + email thread',       agentqa: 'Single shareable link' },
  { aspect: 'Cost',               traditional: '$80k–$150k / yr',             agentqa: 'Free to start' },
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
          {ROWS.map((row, i) => (
            <div
              key={row.aspect}
              className={`grid grid-cols-3 border-b border-zinc-800/60 last:border-0 ${
                i % 2 === 0 ? 'bg-zinc-900/20' : ''
              }`}
            >
              <div className="py-4 px-6 flex items-center">
                <span className="text-sm text-zinc-400 font-medium">{row.aspect}</span>
              </div>
              <div className="py-4 px-6 flex items-center justify-center">
                <span className="text-sm text-zinc-600 text-center">{row.traditional}</span>
              </div>
              <div className="py-4 px-6 flex items-center justify-center bg-blue-500/5 border-l border-blue-500/10">
                <span className="text-sm text-blue-300 font-medium text-center">{row.agentqa}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom callout */}
        <div className="mt-6 p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
          <p className="text-zinc-300 text-sm font-medium">
            A QA engineer costs <span className="text-red-400 font-semibold">$80k–$150k per year</span> and still misses bugs.
            AgentQA finds them in <span className="text-green-400 font-semibold">under 2 minutes</span>, free to start.
          </p>
        </div>
      </div>
    </section>
  )
}
