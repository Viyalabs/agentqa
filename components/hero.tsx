'use client'

import { useState, useEffect } from 'react'
import { Chrome, Zap, Smartphone, AlertCircle, AlertTriangle, WifiOff, ShieldCheck } from 'lucide-react'
import { ScanForm } from './scan-form'
import type { HomeStats } from '@/lib/stats'
import { formatStat } from '@/lib/stats'

const LOGS: Array<{ text: string; color: string }> = [
  { text: 'Launching Chrome browser...', color: 'text-zinc-400' },
  { text: 'Crawling homepage...', color: 'text-blue-400' },
  { text: '✓ Page loaded in 1.3s', color: 'text-green-400' },
  { text: 'Crawling /dashboard...', color: 'text-blue-400' },
  { text: '✗ API request failed (401)', color: 'text-red-400' },
  { text: 'Crawling /pricing...', color: 'text-blue-400' },
  { text: '⚠ TypeError: Cannot read null', color: 'text-yellow-400' },
  { text: '✓ Mobile layout verified', color: 'text-green-400' },
  { text: 'Capturing screenshots...', color: 'text-zinc-400' },
  { text: 'Score: 68/100 · 3 issues found', color: 'text-blue-300' },
]

const ISSUE_CARDS = [
  {
    Icon: WifiOff,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    label: 'Failed API Request',
    detail: '/api/user → 401',
    severity: 'Critical',
    severityColor: 'text-red-400',
  },
  {
    Icon: Smartphone,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    label: 'Mobile Overflow',
    detail: '375px viewport',
    severity: 'Medium',
    severityColor: 'text-yellow-400',
  },
  {
    Icon: AlertCircle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
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
    <div className="relative w-full max-w-md mx-auto lg:mx-0">
      <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/80 backdrop-blur-sm shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
          <span className="ml-3 text-xs text-zinc-500 font-mono">agentqa — live scan</span>
        </div>

        <div className="p-4 font-mono text-xs space-y-1.5 min-h-[220px]">
          {LOGS.slice(0, visibleCount).map((log, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 ${log.color} animate-in fade-in slide-in-from-bottom-1 duration-200`}
            >
              <span className="text-zinc-600 shrink-0 select-none">›</span>
              <span>{log.text}</span>
            </div>
          ))}
          {visibleCount < LOGS.length && (
            <div className="flex items-center gap-2 text-zinc-600">
              <span>›</span>
              <span className="w-2 h-3.5 bg-blue-400 animate-pulse rounded-sm" />
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-xs text-zinc-600 mb-1.5">
            <span>Scanning pages</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
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
    '-right-4 top-6 lg:-right-12',
    '-left-4 top-1/2 -translate-y-1/2 lg:-left-10',
    '-right-4 bottom-10 lg:-right-12',
  ]
  const delays = ['0s', '0.8s', '1.6s']

  return (
    <div
      className={`absolute ${positions[index]} z-10`}
      style={{
        animation: `float 4s ease-in-out infinite`,
        animationDelay: delays[index],
      }}
    >
      <div
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${card.bg} backdrop-blur-sm shadow-lg`}
      >
        <card.Icon className={`h-3.5 w-3.5 shrink-0 ${card.color}`} />
        <div>
          <p className="text-white text-xs font-medium leading-none mb-0.5">{card.label}</p>
          <p className={`text-xs leading-none ${card.severityColor}`}>{card.severity}</p>
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

      <section className="relative overflow-hidden pt-24 pb-16 px-4">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/10 blur-[140px] rounded-full" />
          <div className="absolute top-1/2 left-1/4 w-[400px] h-[300px] bg-cyan-600/5 blur-[100px] rounded-full" />
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            <div className="text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                AI QA agent — zero setup, real browser
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
                Catch bugs before{' '}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  your users do
                </span>
              </h1>

              <p className="text-xl text-zinc-400 mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Your autonomous QA engineer. Paste a URL and get a complete QA report in under 2&nbsp;minutes — no setup, no configuration, no QA team required.
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
                  No QA team needed
                </div>
              </div>

              {/* Social proof */}
              <div className="flex items-center justify-center lg:justify-start gap-8 mt-8 pt-8 border-t border-zinc-800/60">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {formatStat(stats?.appsScanned ?? 0, '1,200')}
                    <span className="text-blue-400">+</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">apps scanned</div>
                </div>
                <div className="w-px h-8 bg-zinc-800" />
                <div>
                  <div className="text-2xl font-bold text-white">
                    {formatStat(stats?.bugsCaught ?? 0, '8,400')}
                    <span className="text-blue-400">+</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">bugs caught</div>
                </div>
                <div className="w-px h-8 bg-zinc-800" />
                <div>
                  <div className="text-2xl font-bold text-white">
                    {formatStat(stats?.pagesScanned ?? 0, '6,000')}
                    <span className="text-blue-400">+</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">pages tested</div>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <ScanTerminal />
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
    description: 'Using Cursor, Replit, or Lovable? AI writes the code. AgentQA catches what the LLM missed.',
  },
  {
    emoji: '🚀',
    title: 'Indie Hackers',
    description: 'Ship fast without a QA bottleneck. Get a scored report on every deploy, not just bug reports from users.',
  },
  {
    emoji: '⚙️',
    title: 'Startups',
    description: "Move at startup speed without hiring a QA team. Know your app's health before every launch.",
  },
  {
    emoji: '🏢',
    title: 'Agencies',
    description: 'Deliver client projects with a professional QA report, not just a Loom walkthrough.',
  },
]

function ForWhoSection() {
  return (
    <section className="py-16 px-4 border-t border-zinc-800/40">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Built for teams that ship fast
          </h2>
          <p className="text-zinc-400">
            AgentQA replaces the QA step that most fast-moving teams skip entirely.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FOR_WHO.map((item) => (
            <div
              key={item.title}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-200"
            >
              <div className="text-3xl mb-3">{item.emoji}</div>
              <h3 className="text-white font-semibold mb-1.5">{item.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
