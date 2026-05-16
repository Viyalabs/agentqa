import { CheckCircle2, AlertCircle, AlertTriangle, Info, Globe, Clock, Sparkles, ArrowRight } from 'lucide-react'

const mockIssues = [
  {
    severity: 'critical' as const,
    title: 'Uncaught JS Error',
    description: "TypeError: Cannot read properties of undefined (reading 'user')",
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    hasAI: true,
  },
  {
    severity: 'medium' as const,
    title: 'Images Missing Alt Text',
    description: '7 images have no alt attribute — WCAG 2.1 accessibility violation.',
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    hasAI: false,
  },
  {
    severity: 'medium' as const,
    title: 'Mobile Layout Overflow',
    description: 'Content overflows viewport on 375 px — users scroll sideways.',
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    hasAI: false,
  },
  {
    severity: 'low' as const,
    title: 'Missing Open Graph Image',
    description: 'No og:image tag — shared links on Slack & Twitter show no preview.',
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    hasAI: false,
  },
]

const mockPages = [
  { url: 'example.com/', status: 200, time: '1.2s', ok: true },
  { url: 'example.com/pricing', status: 200, time: '0.9s', ok: true },
  { url: 'example.com/dashboard', status: 404, time: '0.3s', ok: false },
]

export function ReportPreview() {
  return (
    <section className="py-20 bg-zinc-950/50 border-y border-zinc-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Real output from AgentQA</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            This is what your report looks like
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Every issue ranked by severity, the fix already written. Share your report with a single link — no login required to view it.
          </p>
        </div>

        {/* Mock dashboard */}
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/30 overflow-hidden shadow-2xl">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/80">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/60" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <span className="h-3 w-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs font-mono text-zinc-500 ml-2">agentqa.viyalabs.com/report/</span>
              <span className="text-xs font-mono text-blue-400">a1b2c3d4</span>
              <span className="text-xs text-zinc-500 hidden sm:inline">— permanent shareable link</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Scan complete · 1m 43s
            </div>
          </div>

          <div className="p-5 grid lg:grid-cols-[1fr_1.5fr] gap-6">
            {/* Left column: score + stats */}
            <div className="space-y-4">
              {/* Score card */}
              <div className="p-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">QA Score</div>
                <div className="text-6xl font-bold text-yellow-400 tabular-nums">
                  68
                  <span className="text-2xl text-zinc-600">/100</span>
                </div>
                <div className="text-sm text-yellow-400 mt-1">Fair — 4 issues need attention</div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Pages</div>
                  <div className="flex items-end gap-1.5">
                    <span className="text-3xl font-bold text-white tabular-nums">7</span>
                    <Globe className="h-4 w-4 text-zinc-600 mb-0.5" />
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Issues</div>
                  <div className="text-3xl font-bold text-white tabular-nums">4</div>
                </div>
              </div>

              {/* Severity breakdown */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" /> Critical
                  </span>
                  <span className="font-mono font-bold text-red-400">1</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-yellow-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> Medium
                  </span>
                  <span className="font-mono font-bold text-yellow-400">2</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <Info className="h-3.5 w-3.5" /> Low
                  </span>
                  <span className="font-mono font-bold text-blue-400">1</span>
                </div>
              </div>
            </div>

            {/* Right column: issues + pages */}
            <div className="space-y-4">
              {/* Issues */}
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Issues</div>
                <div className="space-y-2">
                  {mockIssues.map((issue) => (
                    <div key={issue.title}>
                      <div className={`flex items-start gap-3 p-3 rounded-lg border ${issue.bg}`}>
                        <issue.icon className={`h-4 w-4 mt-0.5 shrink-0 ${issue.color}`} />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-medium ${issue.color}`}>{issue.title}</div>
                          <div className="text-xs text-zinc-500 mt-0.5 font-mono">{issue.description}</div>
                        </div>
                      </div>
                      {/* AI analysis inline */}
                      {issue.hasAI && (
                        <div className="ml-3 mt-1 p-3 rounded-b-lg border-x border-b border-blue-500/15 bg-blue-500/5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Sparkles className="h-3 w-3 text-blue-400" />
                            <span className="text-xs font-semibold text-blue-400">AI Analysis</span>
                          </div>
                          <p className="text-xs text-zinc-400 mb-1.5">
                            <span className="text-zinc-600">Root cause: </span>
                            Auth context accessed before session resolves — <code className="text-blue-300">useUser()</code> returns undefined on first render.
                          </p>
                          <p className="text-xs text-green-400">
                            <span className="text-green-600">Fix: </span>
                            Add <code>if (!user) return null</code> guard before accessing user properties in auth-protected components.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pages */}
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Pages scanned</div>
                <div className="space-y-1.5">
                  {mockPages.map((page) => (
                    <div
                      key={page.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/40"
                    >
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                          page.ok
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {page.status}
                      </span>
                      <span className="flex-1 text-xs font-mono text-zinc-400 truncate">{page.url}</span>
                      <span className="text-xs text-zinc-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {page.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inline CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-base text-zinc-400 leading-relaxed">Ready to see your app&apos;s real report?</p>
          <a
            href="#scan-form"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
          >
            Scan My App Free
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  )
}
