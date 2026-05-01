'use client'

import { ArrowRight, Chrome, Zap, ShieldCheck } from 'lucide-react'
import { Button } from './ui/button'

function focusScanInput() {
  const input = document.querySelector<HTMLInputElement>('#scan-form input[type="text"]')
  input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  input?.focus()
}

export function CtaBanner() {
  return (
    <section className="py-14 px-4 border-t border-zinc-800/40">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Your first QA report in under 2 minutes
        </h2>
        <p className="text-zinc-400 mb-8 text-lg">
          No credit card. No setup. No QA team. Just paste your URL and get a scored report with every bug, screenshot, and JS error found.
        </p>
        <Button
          size="lg"
          className="gap-2 text-base px-8 h-12"
          onClick={focusScanInput}
        >
          Scan My App Free
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-sm text-zinc-600">
          <span className="flex items-center gap-1.5">
            <Chrome className="h-3.5 w-3.5" />
            Real Chrome browser
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Results in &lt;2 minutes
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Works with any framework
          </span>
        </div>
      </div>
    </section>
  )
}
