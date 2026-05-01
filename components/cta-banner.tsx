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
    <section className="py-16 border-t border-blue-500/15 bg-blue-950/10">
      <div className="max-w-6xl mx-auto px-6">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-4">Free — no account required</p>
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
          Run your first scan now.
          <br />
          <span className="text-zinc-500">It takes 2 minutes.</span>
        </h2>
        <p className="text-zinc-400 mb-8 text-lg max-w-xl mx-auto">
          Paste your URL. A real browser tests every page. You get a scored report with every bug, screenshot, and JS error — shareable with a single link.
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
        <p className="text-zinc-700 text-xs mt-5">
          No credit card. No sign-up. No setup. Just paste a URL.
        </p>
      </div>
      </div>
    </section>
  )
}
