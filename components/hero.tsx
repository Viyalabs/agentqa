'use client'

import { useState, useEffect } from 'react'
import { Smartphone, WifiOff, Zap, Settings2, Users, Briefcase } from 'lucide-react'
import { ScanForm } from './scan-form'
import type { HomeStats } from '@/lib/stats'
import { formatStat } from '@/lib/stats'
import type { LucideIcon } from 'lucide-react'

const LOGS: Array<{ text: string; color: string; bg?: string; bold?: boolean }> = [
  { text: 'Launching Chrome browser...', color: 'text-zinc-500' },
  { text: 'Crawling /homepage...', color: 'text-blue-400' },
  { text: '✓ Page loaded in 1.3s', color: 'text-green-400' },
  { text: 'Crawling /dashboard...', color: 'text-blue-400' },
  { text: '✗ API request failed (401)', color: 'text-red-300', bg: 'bg-red-500/10 rounded-md' },
  { text: 'Crawling /pricing...', color: 'text-blue-400' },
  { text: '⚠ TypeError: Cannot read null', color: 'text-yellow-300', bg: 'bg-yellow-500/10 rounded-md' },
  { text: '✓ Mobile layout verified', color: 'text-green-400' },
  { text: 'Capturing screenshots...', color: 'text-zinc-500' },
  { text: '● Score: 68/100 · 3 issues found', color: 'text-blue-200', bg: 'bg-blue-500/10 rounded-md', bold: true },
]

const ISSUE_CARDS = [
  {
    Icon: WifiOff,
    color: 'text-red-400',
    bg: 'bg-red-950/90 border-red-500/40',
    label: 'Failed API Request',
    severity: 'Critical',
    severityColor: 'text-red-400',
  },
  {
    Icon: Smartphone,
    color: 'text-yellow-400',
    bg: 'bg-yellow-950/90 border-yellow-500/40',
    label: 'Mobile Overflow',
    severity: 'Medium',
    severityColor: 'text-yellow-400',
  },
]

function ScanTerminal() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let i = 0
    const tick = () => {
      i++
      setVisibleCount(i)
      setProgress(Math.round((i / LOGS.length) * 100))
      if (i < LOGS.length) {
        setTimeout(tick, 650)
      } else {
        setTimeout(() => {
          i = 0
          setVisibleCount(0)
          setProgress(0)
          setTimeout(tick, 400)
        }, 2800)
      }
    }
    const init = setTimeout(tick, 600)
    return () => clearTimeout(init)
  }, [])

  return (
    <div className="relative h-[420px]">
      {/* Ambient glow — absolute, zero layout influence */}
      <div className="absolute -inset-8 bg-blue-600/12 blur-3xl rounded-3xl pointer-events-none" />
      <div className="absolute -inset-3 bg-cyan-500/6 blur-2xl rounded-2xl pointer-events-none" />
      <div className="absolute -bottom-6 left-8 right-8 h-10 bg-blue-500/15 blur-2xl rounded-full pointer-events-none" />

      {/* Terminal card — h-full fills fixed 420px anchor; flex-col controls the three sections */}
      <div className="relative h-full rounded-2xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-sm shadow-[0_25px_60px_rgba(0,0,0,0.7),0_0_30px_rgba(59,130,246,0.05)] ring-1 ring-white/5 overflow-hidden flex flex-col">

        {/* Title bar — shrink-0, never compresses */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/60 shrink-0">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
          <span className="ml-4 text-xs text-zinc-500 font-mono">agentqa — live scan</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-500 font-mono">scanning</span>
          </div>
        </div>

        {/* Log output — flex-1 absorbs remaining height; overflow-hidden prevents any growth */}
        <div className="flex-1 overflow-hidden p-5 font-mono text-sm">
          <div className="space-y-2">
            {LOGS.slice(0, visibleCount).map((log, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 ${log.color} ${log.bg ?? ''} ${log.bold ? 'font-semibold' : ''} px-2 -mx-2 py-0.5 animate-in fade-in duration-300`}
              >
                <span className="text-zinc-700 shrink-0 select-none mt-px">›</span>
                <span className="leading-snug">{log.text}</span>
              </div>
            ))}
            {visibleCount < LOGS.length && (
              <div className="flex items-center gap-2.5 text-zinc-600 px-2 -mx-2">
                <span className="text-zinc-700">›</span>
                <span className="inline-block w-2 h-4 bg-blue-400/90 animate-pulse rounded-sm" />
              </div>
            )}
          </div>
        </div>

        {/* Progress bar — shrink-0, pinned to bottom of flex column */}
        <div className="px-5 pb-5 pt-3 border-t border-zinc-800/60 shrink-0">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-500 font-mono">Scanning pages</span>
            <span className="text-blue-400 font-mono font-semibold tabular-nums">{progress}%</span>
          </div>
          <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)',
                boxShadow: progress > 0 ? '0 0 10px rgba(96,165,250,0.7)' : 'none',
              }}
            />
          </div>
        </div>
      </div>

      {ISSUE_CARDS.map((card, i) => (
        <FloatingCard key={i} card={card} index={i} />
      ))}
    </div>
  )
}

function FloatingCard({
  card,
  index,
}: {
  card: (typeof ISSUE_CARDS)[number]
  index: number
}) {
  const positions = [
    '-right-3 top-8 lg:-right-20',
    '-right-3 bottom-14 lg:-right-20',
  ]
  const delays = ['0s', '1.4s']

  return (
    <div
      className={`absolute ${positions[index]} z-10`}
      style={{
        animation: `float 4s ease-in-out infinite`,
        animationDelay: delays[index],
        willChange: 'transform',
      }}
    >
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${card.bg} backdrop-blur-md shadow-xl shadow-black/50`}>
        <card.Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
        <div>
          <p className="text-white text-xs font-semibold leading-none mb-1">{card.label}</p>
          <p className={`text-[11px] leading-none font-medium ${card.severityColor}`}>{card.severity}</p>
        </div>
      </div>
    </div>
  )
}

export function Hero({ stats }: { stats?: HomeStats }) {
  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      <section className="relative overflow-hidden pt-24 pb-10">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/10 blur-[140px] rounded-full" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[400px] bg-blue-600/6 blur-[120px] rounded-full" />
          <div className="absolute top-1/2 left-1/4 w-[400px] h-[300px] bg-cyan-600/5 blur-[100px] rounded-full" />
        </div>

        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-[44%_56%] gap-10 lg:gap-12 items-center">

            <div className="text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                AI Reliability Intelligence
              </div>

              {/* Headline */}
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white mb-6 leading-[0.95]">
                The QA layer{' '}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  your app ships without.
                </span>
              </h1>

              <p className="text-base text-zinc-400 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Paste a URL or trigger from CI/CD. A real Chrome browser crawls every page on every deploy — catching JS crashes, API failures, mobile breaks, and regressions before users do. Claude AI root-causes each issue and matches it against a growing failure signature library. Scored reliability report in under 2&nbsp;minutes.
              </p>

              <div className="max-w-xl mx-auto lg:mx-0">
                <ScanForm />
              </div>

              <p className="text-sm text-zinc-500 mt-5 text-center lg:text-left">
                Real browser · AI root-cause analysis · Regression detection · CI/CD-ready
              </p>

              {/* Traction — only rendered when real DB data exists */}
              {stats && stats.appsScanned > 0 && (
                <div className="mt-8 pt-8 border-t border-zinc-800/60">
                  <div className="flex items-center justify-center lg:justify-start gap-6">
                    <div>
                      <div className="text-xl font-semibold text-white tabular-nums">
                        {formatStat(stats.appsScanned, '—')}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">apps scanned</div>
                    </div>
                    <div className="w-px h-6 bg-zinc-800" />
                    <div>
                      <div className="text-xl font-semibold text-white tabular-nums">
                        {formatStat(stats.bugsCaught, '—')}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">bugs caught</div>
                    </div>
                    <div className="w-px h-6 bg-zinc-800" />
                    <div>
                      <div className="text-xl font-semibold text-white tabular-nums">
                        {formatStat(stats.pagesScanned, '—')}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">pages tested</div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 mt-3 text-center lg:text-left">
                    Used by teams shipping with Cursor, Replit, Lovable &amp; Vercel
                  </p>
                </div>
              )}
            </div>

            {/* Right: terminal visual */}
            <div className="flex justify-center lg:justify-start pl-0 lg:pl-4">
              <div className="w-full max-w-lg lg:max-w-none">
                <ScanTerminal />
              </div>
            </div>

          </div>
        </div>
      </section>

      <ForWhoSection />
    </>
  )
}

interface ForWhoItem {
  icon: LucideIcon
  iconColor: string
  iconBg: string
  title: string
  description: string
  featured?: boolean
}

const FOR_WHO: ForWhoItem[] = [
  {
    icon: Zap,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10 border-blue-500/20',
    title: 'AI Builders',
    description: 'Using Cursor, Replit, Lovable, or Bolt? LLMs write plausible code that breaks silently. AgentQA is the QA layer your AI-generated app never ships with.',
    featured: true,
  },
  {
    icon: Settings2,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'SaaS Teams',
    description: 'Ship every sprint knowing regressions are caught before users hit them. Triggered from CI/CD — no test suite to write or maintain.',
  },
  {
    icon: Users,
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
    title: 'Founders & Solo Teams',
    description: 'One bug on launch day tanks your momentum. Scan before every deploy — catch the breaking change before it reaches your users.',
  },
  {
    icon: Briefcase,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    title: 'Dev Agencies',
    description: 'Deliver with a QA report attached. Show clients a health score, not just a Loom walkthrough. Charge for reliability, not just delivery.',
  },
]

function ForWhoSection() {
  return (
    <section className="py-20 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Who it&apos;s for</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-3">
            The QA layer for teams that ship fast
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-lg mx-auto">
            Built for the way modern teams ship — fast, lean, and without a dedicated QA department.
          </p>
        </div>

        {/* AI Builders — featured card */}
        {(() => {
          const featured = FOR_WHO[0]
          const FeaturedIcon = featured.icon
          return (
            <div className="mb-6 p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl border ${featured.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <FeaturedIcon className={`h-5 w-5 ${featured.iconColor}`} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1.5">{featured.title}</h3>
                  <p className="text-base text-zinc-400 leading-relaxed">
                    Using Cursor, Replit, Lovable, or Bolt? LLMs write plausible-looking code that breaks silently — broken auth flows, mobile overflows, API crashes at runtime. AgentQA is the real-browser QA pass your AI-generated app never ships with.
                  </p>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Other ICPs */}
        <div className="grid sm:grid-cols-3 gap-4">
          {FOR_WHO.slice(1).map((item) => {
            const Icon = item.icon
            return (
            <div
              key={item.title}
              className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-200 h-full flex flex-col"
            >
              <div className={`w-9 h-9 rounded-lg border ${item.iconBg} flex items-center justify-center mb-4`}>
                <Icon className={`h-4 w-4 ${item.iconColor}`} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-base text-zinc-400 leading-relaxed flex-1">{item.description}</p>
            </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
