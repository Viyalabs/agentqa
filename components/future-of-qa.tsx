const PHASES = [
  {
    time: 'Today',
    status: 'live' as const,
    title: 'Detect bugs automatically',
    description:
      'Real Chrome browser. Every page. Desktop and mobile. Screenshots, JS errors, network failures, and a QA score — in under 2 minutes.',
  },
  {
    time: 'Next',
    status: 'building' as const,
    title: 'Explain root causes with AI',
    description:
      "Not just what broke — but why it broke and how to fix it. AI analysis on every issue so you don't have to guess.",
  },
  {
    time: 'Soon',
    status: 'planned' as const,
    title: 'Fix them automatically',
    description:
      'AgentQA opens a pull request with the fix. Detect, diagnose, and resolve — fully autonomous.',
  },
]

export function FutureOfQA() {
  return (
    <section className="py-24 px-4 border-t border-zinc-800/40">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-4">The Vision</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          The fully autonomous QA engineer
        </h2>
        <p className="text-zinc-400 mb-12 max-w-xl mx-auto">
          We&apos;re building toward QA that requires zero human involvement — from detection to deployed fix.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 text-left">
          {PHASES.map((phase) => (
            <div
              key={phase.time}
              className={`p-6 rounded-xl border ${
                phase.status === 'live'
                  ? 'border-blue-500/30 bg-blue-500/5'
                  : 'border-zinc-800 bg-zinc-900/30'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-xs font-mono font-bold tracking-widest uppercase ${
                    phase.status === 'live' ? 'text-blue-400' : 'text-zinc-600'
                  }`}
                >
                  {phase.time}
                </span>
                {phase.status === 'live' && (
                  <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                    </span>
                    Live
                  </span>
                )}
              </div>
              <h3 className="text-white font-semibold mb-2">{phase.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{phase.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
