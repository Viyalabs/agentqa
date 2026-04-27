import { ScanForm } from './scan-form'
import { Chrome, Zap, Smartphone } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-20 px-4">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/10 blur-[140px] rounded-full" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[300px] bg-cyan-600/5 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          Free automated QA — no setup required
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
          Catch bugs before{' '}
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            your users do
          </span>
        </h1>

        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          Paste your URL. A real Chrome browser crawls every page, tests mobile and
          desktop, captures screenshots, catches JS errors, and delivers a scored
          QA report — in under 2 minutes.
        </p>

        {/* Scan form */}
        <div className="max-w-2xl mx-auto">
          <ScanForm />
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-8 mt-10 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Chrome className="h-4 w-4 text-green-500" />
            Real Chrome browser
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Results in &lt;2 min
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-blue-500" />
            Mobile + desktop tested
          </div>
        </div>
      </div>
    </section>
  )
}
