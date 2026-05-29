import { Zap, AlertTriangle, Shield } from 'lucide-react'

const CARDS = [
  {
    icon: Zap,
    color: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    title: 'AI ships code in minutes',
    body: '30M+ developers now use AI coding tools. Cursor, Lovable, Replit, and Bolt create full-stack apps from prompts — shipping in hours what used to take weeks. The volume of new software is unlike anything before.',
  },
  {
    icon: AlertTriangle,
    color: 'text-red-400',
    iconBg: 'bg-red-500/10',
    border: 'border-red-500/20',
    title: "QA hasn't scaled with it",
    body: 'Traditional QA — Cypress scripts, Playwright suites, manual testers — was designed for teams with weeks to spare. AI-built apps ship before any of it is set up. The gap is widening.',
  },
  {
    icon: Shield,
    color: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    title: 'A new infrastructure layer is emerging',
    body: 'Every AI-built app needs a real-browser reliability pass before it ships. This layer didn\'t exist. AgentQA is that layer — automated, intelligent, and continuously improving.',
  },
]

const ANALOGS = [
  { name: 'Stripe', claim: 'made payments infrastructure accessible to every developer' },
  { name: 'Vercel', claim: 'made deployment infrastructure accessible to every team' },
  { name: 'AgentQA', claim: 'makes reliability infrastructure accessible to every team that ships software', highlight: true },
]

export function WhyNow() {
  return (
    <section className="py-20 border-t border-zinc-800/40" id="why-now">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="max-w-3xl mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Why now</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-5 leading-tight">
            The gap between AI shipping speed<br />
            and QA coverage is growing.
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
            AI coding tools have compressed development timelines from months to hours.
            The reliability infrastructure hasn&apos;t kept up. That gap is where AgentQA operates.
          </p>
        </div>

        {/* Three-card grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {CARDS.map((card) => (
            <div
              key={card.title}
              className={`p-6 rounded-2xl border ${card.border} bg-zinc-900/40`}
            >
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center mb-5`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{card.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>

        {/* Category positioning */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Left: narrative */}
            <div className="p-8 border-b md:border-b-0 md:border-r border-zinc-800">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">The category</p>
              <p className="text-2xl font-semibold text-white leading-snug mb-4">
                Reliability intelligence for every team that ships software.
              </p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Every company that builds software has a QA function — or should.
                Most can&apos;t afford one. AgentQA makes reliability infrastructure
                accessible to every team, at every stage, at a fraction of the cost.
              </p>
            </div>

            {/* Right: analog table */}
            <div className="p-8 flex flex-col justify-center">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600 mb-4">Positioned like</p>
              <div className="space-y-3">
                {ANALOGS.map((item) => (
                  <div
                    key={item.name}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                      item.highlight
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : 'border-zinc-800 bg-zinc-900/40'
                    }`}
                  >
                    <span className={`text-sm font-semibold shrink-0 w-20 ${item.highlight ? 'text-blue-400' : 'text-zinc-400'}`}>
                      {item.name}
                    </span>
                    <span className={`text-sm leading-snug ${item.highlight ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {item.claim}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
