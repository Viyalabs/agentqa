'use client'

import { ArrowRight } from 'lucide-react'
import { Button } from './ui/button'

function focusScanInput() {
  const input = document.querySelector<HTMLInputElement>('#scan-form input[type="text"]')
  input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  input?.focus()
}

export function CtaBanner() {
  return (
    <section className="relative py-20 border-t border-blue-500/15 overflow-hidden">
      {/* Faint radial glow — depth without noise */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[280px] bg-blue-600/8 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative">
        <div className="max-w-2xl mx-auto text-center">

          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">
            Free forever · No credit card
          </p>

          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4 leading-[1.05]">
            Your next deploy could break production.
          </h2>

          <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-md mx-auto">
            Most regressions are found by users, not the team that shipped them.
            Automated QA on every deploy changes that.
          </p>

          <div className="flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="gap-2 text-base px-8 h-12"
              onClick={focusScanInput}
            >
              Scan My App Free
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-zinc-500">
              Free to start · No test suite to write
            </p>
          </div>

          {/* Micro proof row */}
          <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-600">Real Chrome browser</span>
            <span className="text-zinc-800 select-none">·</span>
            <span className="text-xs text-zinc-600">Regression detection</span>
            <span className="text-zinc-800 select-none">·</span>
            <span className="text-xs text-zinc-600">AI root-cause analysis</span>
            <span className="text-zinc-800 select-none">·</span>
            <span className="text-xs text-zinc-600">Mobile + desktop</span>
            <span className="text-zinc-800 select-none">·</span>
            <span className="text-xs text-zinc-600">Under 2 minutes</span>
          </div>

        </div>
      </div>
    </section>
  )
}
