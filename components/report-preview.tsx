import { CheckCircle2, AlertCircle, AlertTriangle, Info, Globe, Clock } from 'lucide-react'

const mockIssues = [
  {
    severity: 'critical' as const,
    title: '404 – Page Not Found',
    description: '/dashboard returned a 404 status code.',
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
  },
  {
    severity: 'medium' as const,
    title: 'Failed API Requests',
    description: '2 network request(s) failed during page load.',
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
  },
  {
    severity: 'low' as const,
    title: 'Slow Page Load',
    description: 'Homepage took 6.2s to load (threshold: 5s).',
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
]

const mockPages = [
  { url: 'example.com/', status: 200, time: '1.2s', ok: true },
  { url: 'example.com/pricing', status: 200, time: '0.9s', ok: true },
  { url: 'example.com/dashboard', status: 404, time: '0.3s', ok: false },
]

export function ReportPreview() {
  return (
    <section className="py-24 px-4 bg-zinc-950/50 border-y border-zinc-800/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            See your QA report
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Every scan produces a full breakdown — score, severity-classified issues, per-page
            status, and screenshots.
          </p>
        </div>

        {/* Mock dashboard */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500">agentqa.dev/scan/</span>
              <span className="text-xs font-mono text-zinc-300">a1b2c3d4</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Scan complete
            </div>
          </div>

          <div className="p-5 grid lg:grid-cols-[1fr_1.5fr] gap-6">
            {/* Left column: score + stats */}
            <div className="space-y-4">
              {/* Score card */}
              <div className="p-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">QA Score</div>
                <div className="text-6xl font-bold text-yellow-400 tabular-nums">
                  73
                  <span className="text-2xl text-zinc-600">/100</span>
                </div>
                <div className="text-sm text-yellow-400 mt-1">Fair</div>
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
                  <div className="text-3xl font-bold text-white tabular-nums">3</div>
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
                  <span className="font-mono font-bold text-yellow-400">1</span>
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
                    <div
                      key={issue.title}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${issue.bg}`}
                    >
                      <issue.icon className={`h-4 w-4 mt-0.5 shrink-0 ${issue.color}`} />
                      <div className="min-w-0">
                        <div className={`text-sm font-medium ${issue.color}`}>{issue.title}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{issue.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pages */}
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Pages</div>
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
      </div>
    </section>
  )
}
