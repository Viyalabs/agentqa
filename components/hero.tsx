import { ScanForm } from './scan-form'
import { Shield, Zap, Eye } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-20 px-4">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          Automated QA for AI-built apps
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
          Ship AI apps{' '}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            with confidence
          </span>
        </h1>

        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          AgentQA crawls your deployed web app, runs real browser tests across every
          page, detects failures, and gives you an actionable QA report — in under 2
          minutes.
        </p>

        {/* Scan form */}
        <div className="max-w-2xl mx-auto">
          <ScanForm />
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-500" />
            Real Playwright browser
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Results in &lt;2 minutes
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-500" />
            Full page screenshots
          </div>
        </div>
      </div>
    </section>
  )
}
