import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, CheckCircle2, Sparkles, GitBranch, Shield, Zap, BarChart3, RefreshCw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Changelog — AgentQA',
  description: 'What\'s new in AgentQA — new features, improvements, and fixes from the Viyalabs team.',
}

interface Release {
  version: string
  date: string
  label: string
  labelColor: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  headline: string
  description: string
  changes: { type: 'feat' | 'fix' | 'perf' | 'refactor'; text: string }[]
}

const RELEASES: Release[] = [
  {
    version: 'v0.6',
    date: 'May 2026',
    label: 'Latest',
    labelColor: 'text-green-400 bg-green-500/10 border-green-500/30',
    icon: Sparkles,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    headline: 'Startup Positioning & Company Identity',
    description: 'Significant improvements to product positioning, company trust signals, and investor-facing copy.',
    changes: [
      { type: 'feat', text: 'New About page with company mission, story, and tech stack' },
      { type: 'feat', text: 'Contact and Terms pages' },
      { type: 'feat', text: 'Footer redesigned to 4-column layout with company identity' },
      { type: 'feat', text: '"AI Reliability Intelligence" — hero badge, metadata, and OG image updated to platform positioning' },
      { type: 'feat', text: 'Continuous Monitoring feature group — recurring scans, CI/CD, regression tracking, alerts' },
      { type: 'feat', text: 'Traction stats in hero: 1,200+ apps · 8,400+ bugs · 6,000+ pages' },
      { type: 'feat', text: '"by Viyalabs" attribution in navbar, footer, and all OG images' },
    ],
  },
  {
    version: 'v0.5',
    date: 'April 2026',
    label: 'Platform',
    labelColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    icon: RefreshCw,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    headline: 'Regression Intelligence',
    description: 'AgentQA adds scheduled scans, regression classification, pattern memory, reliability timelines, and authenticated-flow testing.',
    changes: [
      { type: 'feat', text: 'Recurring scan scheduling — run QA daily, weekly, or on any cadence' },
      { type: 'feat', text: 'Regression intelligence — classifies issues as New, Resolved, Recurring, or Worsened across deploys' },
      { type: 'feat', text: 'Reliability timeline UI — QA score trend chart across all deploys' },
      { type: 'feat', text: 'Regression intelligence panels with severity hierarchy and impact tags' },
      { type: 'feat', text: 'Authenticated-flow scanning — session storage, cookie injection, and protected-route detection' },
      { type: 'feat', text: 'Role-based access control with founder bypass and tiered scan quotas' },
    ],
  },
  {
    version: 'v0.4',
    date: 'March 2026',
    label: 'AI Quality',
    labelColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    icon: Sparkles,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
    headline: 'AI Intelligence Layer',
    description: 'Issue intelligence system, major AI quality improvements, and cross-scan pattern memory.',
    changes: [
      { type: 'feat', text: 'Issue intelligence & software-failure memory — cross-scan pattern database with occurrence tracking' },
      { type: 'feat', text: 'Upgraded AI analysis to senior QA engineer quality — root cause, fix suggestion, confidence rating' },
      { type: 'perf', text: 'AI pipeline cost optimisation — grouped analysis, budget cap, compressed prompts, tiered model selection' },
      { type: 'feat', text: 'Framework detection — identifies React, Next.js, Vue, SvelteKit from network signals' },
      { type: 'feat', text: 'Issue fingerprinting — normalizes UUIDs, line numbers, and stack traces to stable signatures' },
    ],
  },
  {
    version: 'v0.3',
    date: 'February 2026',
    label: 'Report UX',
    labelColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    icon: BarChart3,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    headline: 'Report UX Upgrade & Network Debugging',
    description: 'Complete report redesign, AI overview panel, and restructured network debugging.',
    changes: [
      { type: 'feat', text: 'AI overview panel — scan-level summary with key findings and recommended first fix' },
      { type: 'feat', text: 'Accordion issue layout — expandable cards with stack traces and AI analysis inline' },
      { type: 'refactor', text: 'Replace flat network tab with grouped failure accordions by status code and type' },
      { type: 'feat', text: 'Collapsible network request view with response time and size data' },
      { type: 'fix', text: 'AI batch JSON parser repair and scan email notification delivery' },
    ],
  },
  {
    version: 'v0.2',
    date: 'January 2026',
    label: 'Detection',
    labelColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    icon: Shield,
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10',
    headline: 'Detection Expansion',
    description: 'Mobile testing, video replay, accessibility, and SEO health checks.',
    changes: [
      { type: 'feat', text: 'Mobile responsiveness testing — 375px viewport with side-by-side desktop/mobile screenshots' },
      { type: 'feat', text: 'Video replay — Playwright records full browser sessions for every scan' },
      { type: 'feat', text: 'Accessibility checks — WCAG 2.1 alt text, missing viewport tags, broken mobile layouts' },
      { type: 'feat', text: 'SEO health — missing meta descriptions, absent Open Graph images, H1 issues' },
      { type: 'feat', text: 'Large asset detection — flags images and scripts over 500 KB' },
      { type: 'feat', text: 'Performance flagging — pages above 5s load time classified as Low severity' },
    ],
  },
  {
    version: 'v0.1',
    date: 'December 2025',
    label: 'Launch',
    labelColor: 'text-zinc-400 bg-zinc-800 border-zinc-700',
    icon: Zap,
    iconColor: 'text-zinc-400',
    iconBg: 'bg-zinc-800',
    headline: 'Initial Launch',
    description: 'First public release. Real browser scanning, JS error detection, network monitoring, and permanent shareable reports.',
    changes: [
      { type: 'feat', text: 'Real Chrome browser scanning powered by Playwright' },
      { type: 'feat', text: 'JS error detection with full stack traces from uncaught exceptions' },
      { type: 'feat', text: 'Network request monitoring — status codes, response times, failed calls' },
      { type: 'feat', text: 'QA score (0–100) weighted by issue severity' },
      { type: 'feat', text: 'Permanent shareable report links — no login required to view' },
      { type: 'feat', text: 'Broken image detection across all pages' },
      { type: 'feat', text: '404 and 5xx page error classification' },
    ],
  },
]

const TYPE_CONFIG = {
  feat: { label: 'New', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  fix: { label: 'Fix', color: 'text-green-400', bg: 'bg-green-500/10' },
  perf: { label: 'Perf', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  refactor: { label: 'Refactor', color: 'text-purple-400', bg: 'bg-purple-500/10' },
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-white hover:opacity-90 transition-opacity">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>AgentQA</span>
            <span className="text-xs text-zinc-600 font-normal hidden md:inline ml-0.5">by Viyalabs</span>
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
            ← Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-14">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-4">Product Updates</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">Changelog</h1>
          <p className="text-zinc-400 leading-relaxed max-w-xl">
            Every release, feature, and improvement to AgentQA — automated QA testing for modern software teams.
            Built by <a href="https://viyalabs.com" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-white transition-colors">Viyalabs</a> in Chennai, India.
          </p>
        </div>

        {/* Releases */}
        <div className="space-y-14">
          {RELEASES.map((release, i) => (
            <div key={release.version} className="relative">
              {/* Vertical line */}
              {i < RELEASES.length - 1 && (
                <div className="absolute left-[19px] top-[48px] bottom-[-40px] w-px bg-zinc-800/80" />
              )}

              <div className="flex items-start gap-5">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl ${release.iconBg} border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5 relative z-10`}>
                  <release.icon className={`h-4 w-4 ${release.iconColor}`} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Release header */}
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="text-white font-semibold text-lg">{release.version}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${release.labelColor}`}>
                      {release.label}
                    </span>
                    <span className="text-xs text-zinc-600 font-mono">{release.date}</span>
                  </div>

                  <h2 className="text-base font-semibold text-white mb-1">{release.headline}</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-5">{release.description}</p>

                  {/* Changes */}
                  <div className="space-y-2">
                    {release.changes.map((change, j) => {
                      const cfg = TYPE_CONFIG[change.type]
                      return (
                        <div key={j} className="flex items-start gap-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold shrink-0 mt-0.5 ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-sm text-zinc-400 leading-relaxed">{change.text}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-16 pt-10 border-t border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-sm text-zinc-300 font-medium">Actively developed</span>
          </div>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            AgentQA ships new capabilities every few weeks. Follow development on GitHub or email us to request a feature.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://github.com/Viyalabs/agentqa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-sm font-medium transition-colors"
            >
              Follow on GitHub
            </a>
            <a
              href="mailto:info@viyalabs.com?subject=AgentQA Feature Request"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-sm font-medium transition-colors"
            >
              Request a feature
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              Try AgentQA Free
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800 mt-8 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <span>© {new Date().getFullYear()} Viyalabs. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
            <Link href="/about" className="hover:text-zinc-400 transition-colors">About</Link>
            <Link href="/contact" className="hover:text-zinc-400 transition-colors">Contact</Link>
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
