'use client'

import { useState, useEffect } from 'react'
import { Chrome, Zap, Smartphone, AlertCircle, WifiOff, ShieldCheck } from 'lucide-react'
import { ScanForm } from './scan-form'
import type { HomeStats } from '@/lib/stats'

const FLOOR = { appsScanned: 1200, bugsCaught: 8400, pagesScanned: 6000 }

function useCountUp(target: number, duration = 1600): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return val
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

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
    detail: '/api/user → 401',
    severity: 'Critical',
    severityColor: 'text-red-400',
  },
  {
    Icon: Smartphone,
    color: 'text-yellow-400',
    bg: 'bg-yellow-950/90 border-yellow-500/40',
    label: 'Mobile Overflow',
    detail: '375px viewport',
    severity: 'Medium',
    severityColor: 'text-yellow-400',
  },
  {
    Icon: AlertCircle,
    color: 'text-orange-400',
    bg: 'bg-orange-950/90 border-orange-500/40',
    label: 'JS Exception',
    detail: 'TypeError: null ref',
    severity: 'Critical',
    severityColor: 'text-red-400',
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
    <div className="relative w-full">
      {/* Ambient glow behind terminal */}
      <div className="absolute -inset-6 bg-blue-600/8 blur-3xl rounded-3xl pointer-events-none" />
      <div className="absolute -inset-2 bg-cyan-600/4 blur-xl rounded-2xl pointer-events-none" />

      <div className="relative rounded-2xl border border-zinc-700/70 bg-zinc-900/95 backdrop-blur-sm shadow-2xl shadow-black/60 ring-1 ring-white/5 overflow-hidden">

        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/60">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
          <span className="ml-4 text-xs text-zinc-500 font-mono">agentqa — live scan</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-500 font-mono">scanning</span>
          </div>
        </div>

        {/* Log output */}
        <div className="p-5 font-mono text-sm space-y-2 min-h-[260px]">
          {LOGS.slice(0, visibleCount).map((log, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 ${log.color} ${log.bg ?? ''} ${log.bold ? 'font-semibold' : ''} px-2 -mx-2 py-0.5 animate-in fade-in slide-in-from-bottom-1 duration-200`}
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

        {/* Progress bar */}
        <div className="px-5 pb-5 pt-2 border-t border-zinc-800/60">
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
    '-right-3 top-8 lg:-right-16',
    '-left-3 top-1/2 -translate-y-1/2 lg:-left-14',
    '-right-3 bottom-14 lg:-right-16',
  ]
  const delays = ['0s', '0.9s', '1.8s']

  return (
    <div
      className={`absolute ${positions[index]} z-10`}
      style={{
        animation: `float 4s ease-in-out infinite`,
        animationDelay: delays[index],
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
  const appsTarget = stats?.appsScanned || FLOOR.appsScanned
  const bugsTarget = stats?.bugsCaught || FLOOR.bugsCaught
  const pagesTarget = stats?.pagesScanned || FLOOR.pagesScanned

  const appsCount = useCountUp(appsTarget)
  const bugsCount = useCountUp(bugsTarget)
  const pagesCount = useCountUp(pagesTarget)

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      <section className="relative overflow-hidden pt-24 pb-16">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/10 blur-[140px] rounded-full" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[400px] bg-blue-600/6 blur-[120px] rounded-full" />
          <div className="absolute top-1/2 left-1/4 w-[400px] h-[300px] bg-cyan-600/5 blur-[100px] rounded-full" />
        </div>

        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-[44%_56%] gap-10 lg:gap-12 items-center">

            <div className="text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                Meet your AI QA engineer
              </div>

              {/* Headline */}
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.1]">
                Catch bugs before{' '}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  your users do
                </span>
              </h1>

              <p className="text-base text-zinc-400 mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Manual QA is being replaced. AgentQA is the replacement — paste a URL, and your AI QA engineer delivers a complete report with root-cause analysis in under 2&nbsp;minutes.
              </p>

              <div className="max-w-xl mx-auto lg:mx-0">
                <ScanForm />
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 mt-8 text-sm text-zinc-500">
                <div className="flex items-center gap-2">
                  <Chrome className="h-4 w-4 text-green-500" />
                  Real Chrome browser
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Results in &lt;2 min
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  No QA experience required
                </div>
              </div>

              {/* Social proof */}
              <div className="mt-8 pt-8 border-t border-zinc-800/60">
                <div className="flex items-center justify-center lg:justify-start gap-8">
                  <div>
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {fmtCount(appsCount)}<span className="text-blue-400">+</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">apps scanned</div>
                  </div>
                  <div className="w-px h-8 bg-zinc-800" />
                  <div>
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {fmtCount(bugsCount)}<span className="text-blue-400">+</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">bugs caught</div>
                  </div>
                  <div className="w-px h-8 bg-zinc-800" />
                  <div>
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {fmtCount(pagesCount)}<span className="text-blue-400">+</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">pages tested</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-3">
                  <p className="text-xs text-zinc-500">
                    Trusted by indie builders, agencies, and AI-first startups shipping daily
                  </p>
                  <a
                    href="/scans"
                    className="text-xs text-blue-400/80 hover:text-blue-400 border border-blue-500/20 bg-blue-500/5 px-2.5 py-0.5 rounded-full transition-colors shrink-0"
                  >
                    See recent reports →
                  </a>
                </div>
              </div>
            </div>

            {/* Right: terminal visual — 56% column, full width, floats */}
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

const FOR_WHO = [
  {
    emoji: '⚡',
    title: 'AI Builders',
    description: 'Using Cursor, Replit, Lovable, or Bolt? LLMs write plausible code that breaks silently. AgentQA is the QA layer your AI-generated app never ships with.',
    featured: true,
  },
  {
    emoji: '🚀',
    title: 'Indie Hackers',
    description: 'Ship without a QA bottleneck. Run a scan on every deploy — catch the bug that would have killed your launch tweet before users do.',
  },
  {
    emoji: '⚙️',
    title: 'Startups',
    description: "Move at startup speed without a $100k QA hire. Get a scored health report before every release — no test suite to maintain.",
  },
  {
    emoji: '🏢',
    title: 'Agencies',
    description: 'Hand off client projects with a QA report instead of a Loom walkthrough. Clients will think you have a dedicated QA team.',
  },
]

function ForWhoSection() {
  return (
    <section className="py-16 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Who it&apos;s for</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-3">
            The QA layer for teams that ship fast
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-lg mx-auto">
            Built for the way modern teams ship — fast, lean, and without a dedicated QA department.
          </p>
        </div>

        {/* AI Builders — featured card */}
        <div className="mb-4 p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 transition-colors">
          <div className="flex items-start gap-4">
            <div className="text-2xl shrink-0 mt-0.5">⚡</div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-xl font-semibold text-white">AI Builders</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium">Primary audience</span>
              </div>
              <p className="text-base text-zinc-400 leading-relaxed">
                Using Cursor, Replit, Lovable, or Bolt? LLMs write plausible-looking code that breaks silently — broken auth flows, mobile overflows, API crashes at runtime. AgentQA is the real-browser QA pass your AI-generated app never ships with.
              </p>
            </div>
          </div>
        </div>

        {/* Other ICPs */}
        <div className="grid sm:grid-cols-3 gap-4">
          {FOR_WHO.slice(1).map((item) => (
            <div
              key={item.title}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-200"
            >
              <div className="text-2xl mb-3">{item.emoji}</div>
              <h3 className="text-xl font-semibold text-white mb-1.5">{item.title}</h3>
              <p className="text-base text-zinc-400 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
