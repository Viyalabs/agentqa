import { ArrowRight, MapPin, Code2, Sparkles, Shield } from 'lucide-react'
import Link from 'next/link'

const TECH_STACK = ['Playwright', 'Claude AI', 'Next.js', 'Vercel', 'Supabase', 'PostgreSQL']

const PILLARS = [
  {
    icon: Code2,
    title: 'Real browser testing',
    body: 'Every scan uses a headless Chrome browser — the same environment your users get. JS errors, mobile overflow, network failures: caught as they happen.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Sparkles,
    title: 'AI reliability intelligence',
    body: 'Claude AI analyzes every detected issue — root cause, technical explanation, and a developer-ready fix. Not just detection. Explanation.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Shield,
    title: 'Cross-scan pattern detection',
    body: 'We track issue fingerprints across all scans. Known bugs get instant answers from historical patterns — no AI latency on repeat issues.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
]

export function AboutSection() {
  return (
    <section className="py-16 border-t border-zinc-800/40" id="about">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Left: mission + story */}
          <div>
            <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">About AgentQA</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-5">
              The reliability layer for modern software
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              AI coding tools are changing how software gets built — apps that used to take months now ship in days. But speed without reliability isn&apos;t progress. Production bugs erode trust faster than features build it.
            </p>
            <p className="text-zinc-400 leading-relaxed mb-4">
              AgentQA gives every team — from solo founders to growing startups — the automated QA infrastructure that used to require a dedicated testing department.
            </p>
            <p className="text-zinc-400 leading-relaxed mb-8">
              Real browser testing. AI-powered root cause analysis. Cross-scan pattern intelligence. Built for the pace at which AI ships code.
            </p>

            {/* Mission callout */}
            <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 mb-8">
              <p className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-2">Mission</p>
              <p className="text-white font-semibold text-lg leading-snug">
                &ldquo;AI-generated apps ship faster than teams can test them. AgentQA changes that.&rdquo;
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500 mb-6">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-600" />
                Chennai, India
              </span>
              <span className="text-zinc-700">·</span>
              <span>AgentQA by Viyalabs</span>
              <span className="text-zinc-700">·</span>
              <span>Founded 2025</span>
            </div>

            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Learn more about us
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Right: pillars + tech stack */}
          <div className="space-y-4">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="flex items-start gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg ${p.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <p.icon className={`h-4 w-4 ${p.color}`} />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">{p.title}</p>
                  <p className="text-zinc-400 text-sm leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}

            {/* Tech stack */}
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40">
              <p className="text-xs text-zinc-600 uppercase tracking-wider font-mono mb-3">Built on proven infrastructure</p>
              <div className="flex flex-wrap gap-2">
                {TECH_STACK.map((tech) => (
                  <span
                    key={tech}
                    className="text-xs px-2.5 py-1 rounded-md border border-zinc-700 text-zinc-400 font-mono"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
