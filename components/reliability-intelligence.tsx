import { getAdminClient } from '@/lib/supabase'
import { TrendingUp, RefreshCw, Brain, Shield } from 'lucide-react'

interface RecurringPattern {
  id:                string
  title:             string
  type:              string
  severity:          string
  recurrence_count:  number
  affected_frameworks: string[] | null
  avg_days_to_recur: number | null
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

const FRAMEWORK_LABELS: Record<string, string> = {
  nextjs:   'Next.js',
  react:    'React',
  vue:      'Vue',
  nuxt:     'Nuxt',
  shopify:  'Shopify',
  laravel:  'Laravel',
  rails:    'Rails',
  any:      'Any framework',
}

async function getIntelligenceData() {
  try {
    const db = getAdminClient()

    const [
      { count: patternCount },
      { count: sigMatchedCount },
      { count: recurringCount },
      { data: topRecurring },
    ] = await Promise.all([
      db.from('issue_patterns')
        .select('*', { count: 'exact', head: true }),

      db.from('failure_signatures')
        .select('*', { count: 'exact', head: true })
        .gt('occurrence_count', 0),

      db.from('issue_patterns')
        .select('*', { count: 'exact', head: true })
        .gt('recurrence_count', 0),

      db.from('issue_patterns')
        .select('id, title, type, severity, recurrence_count, affected_frameworks, avg_days_to_recur')
        .gt('recurrence_count', 0)
        .order('recurrence_count', { ascending: false })
        .limit(3),
    ])

    return {
      patternCount:    patternCount  ?? 0,
      sigMatchedCount: sigMatchedCount ?? 0,
      recurringCount:  recurringCount  ?? 0,
      topRecurring:    (topRecurring ?? []) as RecurringPattern[],
    }
  } catch {
    return { patternCount: 0, sigMatchedCount: 0, recurringCount: 0, topRecurring: [] }
  }
}

export async function ReliabilityIntelligence() {
  const { patternCount, sigMatchedCount, recurringCount, topRecurring } = await getIntelligenceData()

  const hasData = patternCount > 0

  return (
    <section className="py-20 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-8 items-end mb-12">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">
              Cross-scan intelligence
            </p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
              Issues get detected.
              <br />
              <span className="text-blue-400">Then remembered.</span>
            </h2>
          </div>
          <p className="text-base text-zinc-400 leading-relaxed lg:pb-1">
            Every scan feeds a shared pattern library. Known bug signatures are matched instantly —
            no Claude call, no latency. Regressions are tracked across deploys, not just per scan.
          </p>
        </div>

        {/* Intelligence architecture — always visible */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            {
              icon: Brain,
              color: 'text-blue-400',
              bg: 'bg-blue-500/10 border-blue-500/20',
              label: 'Pattern memory',
              body: 'Every detected issue is fingerprinted and stored. Repeat occurrences are matched instantly across all future scans.',
            },
            {
              icon: Shield,
              color: 'text-cyan-400',
              bg: 'bg-cyan-500/10 border-cyan-500/20',
              label: 'Signature matching',
              body: '33 known framework failure signatures — Next.js hydration, Shopify race conditions, Laravel CSRF — matched before AI analysis.',
            },
            {
              icon: RefreshCw,
              color: 'text-yellow-400',
              bg: 'bg-yellow-500/10 border-yellow-500/20',
              label: 'Regression detection',
              body: 'Issues marked resolved are tracked. If a fingerprint reappears in a future scan, it is flagged as a regression — not a new issue.',
            },
            {
              icon: TrendingUp,
              color: 'text-green-400',
              bg: 'bg-green-500/10 border-green-500/20',
              label: 'Compounding accuracy',
              body: 'Each scan refines root cause confidence. High-frequency failure patterns get faster, more accurate diagnosis over time.',
            },
          ].map((pillar) => (
            <div
              key={pillar.label}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col gap-3"
            >
              <div className={`w-8 h-8 rounded-lg border ${pillar.bg} flex items-center justify-center shrink-0`}>
                <pillar.icon className={`h-4 w-4 ${pillar.color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">{pillar.label}</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{pillar.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Live intelligence counters — only when real data exists */}
        {hasData && (
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
              <div className="text-3xl font-bold text-white tabular-nums mb-1">
                {patternCount.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">failure patterns learned</div>
            </div>
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
              <div className="text-3xl font-bold text-white tabular-nums mb-1">
                {sigMatchedCount.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">known signatures matched</div>
            </div>
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
              <div className="text-3xl font-bold text-white tabular-nums mb-1">
                {recurringCount.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">recurring regressions tracked</div>
            </div>
          </div>
        )}

        {/* Recurring pattern cards — only when regressions exist */}
        {topRecurring.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">
              Top recurring regressions
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topRecurring.map((pattern) => {
                const frameworks = (pattern.affected_frameworks ?? [])
                  .map((f) => FRAMEWORK_LABELS[f] ?? f)
                  .slice(0, 2)
                const sevColor = SEVERITY_COLOR[pattern.severity] ?? SEVERITY_COLOR.low

                return (
                  <div
                    key={pattern.id}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${sevColor}`}>
                        {pattern.severity}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-yellow-400 font-mono shrink-0">
                        <RefreshCw className="h-3 w-3" />
                        {pattern.recurrence_count}× recurred
                      </span>
                    </div>

                    <p className="text-sm font-medium text-zinc-100 leading-snug mb-3 line-clamp-2">
                      {pattern.title}
                    </p>

                    <div className="flex items-center justify-between text-xs text-zinc-600">
                      <span>
                        {frameworks.length > 0
                          ? frameworks.join(', ')
                          : 'Framework-agnostic'}
                      </span>
                      {pattern.avg_days_to_recur !== null && (
                        <span>~{Math.round(pattern.avg_days_to_recur)}d avg recurrence</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No-regression state — honest positive signal */}
        {hasData && recurringCount === 0 && (
          <div className="p-5 rounded-xl border border-zinc-800/60 bg-zinc-900/20 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <p className="text-sm text-zinc-400">
              <span className="text-white font-medium">No regressions detected</span>
              {' '}— every resolved issue has stayed resolved across all tracked domains.
            </p>
          </div>
        )}

      </div>
    </section>
  )
}
