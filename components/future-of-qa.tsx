const PHASES = [
  {
    step: '01',
    label: 'Live now',
    status: 'live' as const,
    verb: 'Detect',
    title: 'Every bug found automatically',
    description:
      'Real Chrome browser crawls every page — desktop and mobile. JS errors, network failures, layout breaks, 404s — scored and classified in under 2 minutes.',
  },
  {
    step: '02',
    label: 'Live now',
    status: 'live' as const,
    verb: 'Explain',
    title: 'AI tells you why it broke',
    description:
      "Claude AI analyzes every issue — root cause, technical reason, and a specific code fix. Not just what broke, but exactly how to resolve it.",
  },
  {
    step: '03',
    label: 'Coming next',
    status: 'building' as const,
    verb: 'Fix',
    title: 'AgentQA opens the PR',
    description:
      'Detect, diagnose, and patch — fully autonomous. AgentQA opens a pull request with the fix so you can ship with confidence.',
  },
]

export function FutureOfQA() {
  return (
    <section className="py-16 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">The roadmap</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Detect → Explain → Fix
        </h2>
        <p className="text-zinc-400 mb-10 max-w-xl mx-auto">
          The first two steps are live today. The third makes AgentQA the only QA tool that closes the loop without a human.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 text-left">
          {PHASES.map((phase) => (
            <div
              key={phase.step}
              className={`p-6 rounded-xl border ${
                phase.status === 'live'
                  ? 'border-blue-500/30 bg-blue-500/5'
                  : 'border-zinc-800 bg-zinc-900/30 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-600">{phase.step}</span>
                  <span className={`text-lg font-bold ${phase.status === 'live' ? 'text-white' : 'text-zinc-500'}`}>
                    {phase.verb}
                  </span>
                </div>
                {phase.status === 'live' ? (
                  <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                    </span>
                    Live
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600 font-mono">Soon</span>
                )}
              </div>
              <h3 className="text-white font-semibold mb-2 text-sm">{phase.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{phase.description}</p>
            </div>
          ))}
        </div>
      </div>
      </div>
    </section>
  )
}
