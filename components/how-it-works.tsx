import { Globe, ScanSearch, FileBarChart, Sparkles } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Globe,
    title: 'Paste your URL',
    description:
      'Enter the deployed URL of your web app. No credentials, no config, no setup. Works with any publicly accessible URL.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    number: '02',
    icon: ScanSearch,
    title: 'We crawl & test',
    description:
      'A real Chrome browser visits every page — testing desktop and mobile, catching JS errors with full stack traces, inspecting every network request, and flagging mobile layout breaks at 375 px.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    number: '03',
    icon: FileBarChart,
    title: 'Get your report',
    description:
      'A 0–100 reliability score with severity-classified issues, desktop and mobile screenshots, network request logs, and a page-by-page breakdown — shareable via a single permanent link.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    number: '04',
    icon: Sparkles,
    title: 'AI explains the why',
    description:
      'Claude AI cross-references each issue against a shared pattern library from real bugs across all AgentQA scans. Root cause, targeted fix, and a confidence rating — not just a stack trace to decode.',
    color: 'text-cyan-300',
    bg: 'bg-blue-500/20 border-blue-400/50',
    badge: 'Live',
    highlight: true,
  },
]

export function HowItWorks() {
  return (
    <section className="py-20 border-t border-zinc-800/40" id="how-it-works">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">How it works</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            From deploy to reliability report in minutes
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Four automated phases — crawl, test, analyze, report — running on every deploy. Every issue ranked by severity, root-caused by AI, and matched against a growing failure pattern library.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] right-0 h-px bg-zinc-800 -z-0" />
              )}

              <div className="relative flex flex-col items-center text-center">
                {/* Icon circle */}
                <div
                  className={`w-16 h-16 rounded-2xl border ${step.bg} flex items-center justify-center mb-5 z-10 relative ${'highlight' in step && step.highlight ? 'shadow-lg shadow-blue-500/20' : ''}`}
                >
                  <step.icon className={`h-7 w-7 ${step.color}`} />
                  {step.badge && (
                    <span className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-bold leading-none">
                      {step.badge}
                    </span>
                  )}
                </div>

                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  STEP {step.number}
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${'highlight' in step && step.highlight ? 'text-cyan-100' : 'text-white'}`}>
                  {step.title}
                </h3>
                <p className={`text-base leading-relaxed ${'highlight' in step && step.highlight ? 'text-zinc-300' : 'text-zinc-400'}`}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
