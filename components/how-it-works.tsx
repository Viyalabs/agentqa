import { Globe, ScanSearch, FileBarChart } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Globe,
    title: 'Paste your URL',
    description:
      'Enter the deployed URL of your web application. Works with any public URL — Next.js, React, Vue, or AI-generated apps.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    number: '02',
    icon: ScanSearch,
    title: 'We crawl & test',
    description:
      'A real Chrome browser visits every page — testing desktop and mobile layouts, catching JS errors with stack traces, inspecting network requests, and recording video of any failures.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    number: '03',
    icon: FileBarChart,
    title: 'Get your report',
    description:
      'Receive a 0–100 QA score with severity-classified issues, page screenshots, video replays, and a network debugging tab — shareable via a single link.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
]

export function HowItWorks() {
  return (
    <section className="py-16 px-4" id="how-it-works">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            From URL to report in 3 steps
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            No configuration, no setup, no waiting for CI. Paste a URL and get a full QA report in under 2 minutes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {step.number !== '03' && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+3rem)] w-[calc(100%-3rem)] h-px bg-zinc-800 -z-0" />
              )}

              <div className="relative flex flex-col items-center text-center">
                {/* Icon circle */}
                <div
                  className={`w-16 h-16 rounded-2xl border ${step.bg} flex items-center justify-center mb-6 z-10`}
                >
                  <step.icon className={`h-7 w-7 ${step.color}`} />
                </div>

                <div
                  className={`text-xs font-mono font-bold ${step.color} mb-2 tracking-widest`}
                >
                  STEP {step.number}
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
