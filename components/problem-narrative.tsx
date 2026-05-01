import { Zap, Wrench, TrendingUp } from 'lucide-react'

export function ProblemNarrative() {
  return (
    <>
      {/* Why AgentQA Exists */}
      <section className="py-14 px-4 border-t border-zinc-800/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">The Problem</p>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight">
              AI ships code in minutes.
              <br />
              <span className="text-zinc-500">Testing is still done by hand.</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Cursor writes your app. Vercel deploys it. But someone still has to manually click through every page and hope nothing is broken. QA has not kept pace with how fast software ships.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 mb-10">
            {[
              {
                Icon: TrendingUp,
                color: 'text-yellow-400',
                bg: 'bg-yellow-500/10',
                label: 'Shipping is 10× faster',
                body: 'AI tools can generate a full web app in under an hour. The speed of building has changed permanently.',
              },
              {
                Icon: Wrench,
                color: 'text-red-400',
                bg: 'bg-red-500/10',
                label: 'QA is still manual',
                body: 'A QA engineer clicking through pages, writing scripts that go stale, filing tickets. A process designed for the 2000s.',
              },
              {
                Icon: Zap,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                label: 'Most teams skip QA entirely',
                body: 'Startups and solo builders cannot afford a QA team. So bugs reach users. Users churn. Reputation suffers.',
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
              AgentQA is the QA engineer you never had to hire.
            </p>
            <p className="text-zinc-400 mt-3 text-lg">Autonomous. Instant. Free to start.</p>
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-zinc-500">
              <span>Real Chrome browser</span>
              <span className="text-zinc-700">·</span>
              <span>Zero configuration</span>
              <span className="text-zinc-700">·</span>
              <span>Works with any framework</span>
            </div>
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
    note: 'Writes production code at speed. AgentQA verifies it actually works in a real browser.',
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

function AiAppsSection() {
  return (
    <section className="py-14 px-4 border-t border-zinc-800/40">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Built for the new stack</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-tight">
              Apps built with AI break differently
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed mb-5">
              LLMs write plausible-looking code that passes a visual check — then fails silently in production. Mobile viewports overflow. API calls return 401s. JavaScript crashes at runtime. The LLM doesn&apos;t know.
            </p>
            <p className="text-zinc-400 text-lg leading-relaxed">
              AgentQA is the real-browser QA layer that AI-generated apps never ship with. Built for the failure patterns of AI-written code — not the manual scripts of 2005.
            </p>
          </div>

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
