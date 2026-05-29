import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ArrowRight, MapPin, Code2, Sparkles, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About — AgentQA',
  description: 'AgentQA is an automated QA testing platform for modern web apps, built by Praveen Kumar at Viyalabs in Chennai, India.',
  openGraph: {
    title: 'About AgentQA — Automated QA Testing',
    description: 'Automated QA testing for modern web apps. Real browser testing, AI root cause analysis, and cross-scan regression detection.',
  },
}

const TECH_STACK = [
  { name: 'Playwright', desc: 'Real browser automation' },
  { name: 'Claude AI', desc: 'Issue analysis & root cause' },
  { name: 'Next.js', desc: 'App framework' },
  { name: 'Supabase', desc: 'Database & storage' },
  { name: 'Vercel', desc: 'Deployment & edge' },
  { name: 'PostgreSQL', desc: 'Structured data & patterns' },
]

const WHAT_WE_BUILD = [
  {
    icon: Code2,
    title: 'Real browser QA',
    body: 'Playwright-powered crawling across every page — desktop and mobile — detecting JS errors, broken images, failed API requests, and layout issues as they happen in a real Chrome environment.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Sparkles,
    title: 'AI root-cause analysis',
    body: 'Claude AI analyzes every detected issue — root cause, technical explanation, and developer-ready fix suggestion. Not just detection: explanation.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Shield,
    title: 'Cross-scan pattern detection',
    body: 'We build a knowledge graph of issue fingerprints across all scans. Known bugs get instant answers from historical patterns — zero AI latency on repeat issues.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-white hover:opacity-90 transition-opacity">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-sm"
            >
              Try Free
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="mb-16 max-w-3xl">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-4">About AgentQA</p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-6 leading-tight">
            Automated QA testing<br />for modern software
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed">
            We&apos;re building the automated QA testing platform for the next generation of software. As AI coding tools make shipping faster than ever, teams need a smarter way to catch bugs before users do.
          </p>
        </div>

        {/* Mission */}
        <div className="mb-16 p-8 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Mission</p>
          <p className="text-2xl md:text-3xl font-semibold text-white leading-snug">
            &ldquo;AI-generated apps ship faster than teams can test them. AgentQA changes that.&rdquo;
          </p>
        </div>

        {/* Story + What we build */}
        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Why we built this</h2>
            <div className="space-y-4 text-zinc-400 leading-relaxed text-sm">
              <p>
                The rise of AI coding tools — Cursor, Replit, Lovable, Bolt — has fundamentally changed how software gets built. Teams ship faster than ever. Individuals build apps that used to require full engineering teams.
              </p>
              <p>
                But LLMs write plausible-looking code that breaks silently. Mobile viewports overflow. API calls return 401s. JavaScript crashes at runtime in ways that only appear in a real browser. The tooling for catching these bugs hasn&apos;t kept up.
              </p>
              <p>
                Traditional QA tools require test scripts, CI configuration, and engineering time. Most small teams skip QA entirely — and bugs reach users instead.
              </p>
              <p>
                AgentQA is built to change that. One URL, 90 seconds, and you have a complete QA report — with AI explaining exactly what broke and how to fix it.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-4">What we&apos;re building</h2>
            <div className="space-y-3">
              {WHAT_WE_BUILD.map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold mb-0.5">{item.title}</p>
                    <p className="text-zinc-400 text-xs leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Company facts */}
        <div className="grid sm:grid-cols-3 gap-4 mb-16">
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Company</p>
            <p className="text-white font-semibold">Viyalabs</p>
            <p className="text-zinc-500 text-sm mt-1">Software reliability tooling</p>
          </div>
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Headquarters</p>
            <p className="text-white font-semibold flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-zinc-600" />
              Chennai, India
            </p>
            <p className="text-zinc-500 text-sm mt-1">Founded 2025</p>
          </div>
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Stage</p>
            <p className="text-white font-semibold">Early Access</p>
            <p className="text-zinc-500 text-sm mt-1">Actively launching</p>
          </div>
        </div>

        {/* Founder */}
        <div className="mb-16 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30">
          <p className="text-xs text-zinc-600 uppercase tracking-wider font-mono mb-5">Built by</p>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-base select-none">
              P
            </div>
            <div>
              <p className="text-white font-semibold text-lg leading-tight">Praveen Kumar</p>
              <p className="text-zinc-500 text-sm mt-0.5">Founder, Viyalabs · Chennai, India</p>
              <p className="text-zinc-400 text-sm leading-relaxed mt-3 max-w-xl">
                I built AgentQA after watching AI coding tools ship apps with silent bugs — broken auth flows,
                mobile overflows, JS crashes that only appear in a real browser. Traditional QA tooling
                requires test scripts and engineering time most teams don&apos;t have. I wanted one URL to fix that.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <a
                  href="mailto:info@viyalabs.com"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  info@viyalabs.com
                </a>
                <span className="text-zinc-700">·</span>
                <a
                  href="https://www.linkedin.com/in/praveen-perfeito-75852a64/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Tech stack */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-white mb-6">Built on proven infrastructure</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {TECH_STACK.map((tech) => (
              <div key={tech.name} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
                <span className="text-sm font-mono text-zinc-300 font-medium">{tech.name}</span>
                <span className="text-xs text-zinc-600">{tech.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Ready to see it in action?</h2>
          <p className="text-zinc-400 text-sm mb-6">Paste a URL and get a full QA report in under 2 minutes — free, no account required.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
            >
              Try AgentQA Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
              Contact us →
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800 mt-16 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <span>© {new Date().getFullYear()} Viyalabs. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
            <Link href="/contact" className="hover:text-zinc-400 transition-colors">Contact</Link>
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
