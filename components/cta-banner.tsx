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
    <section className="py-20 border-t border-blue-500/15 bg-blue-950/10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Free forever · No credit card</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-6">
            You have bugs you don&apos;t know about.
            <br />
            <span className="text-zinc-500">Run your first scan now — takes under 2 minutes.</span>
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed mb-8 max-w-xl mx-auto">
            Most broken pages are never found by the team that built them — they&apos;re found by users. One scan before launch changes that.
          </p>
          <Button
            size="lg"
            className="gap-2 text-base px-8 h-12"
            onClick={focusScanInput}
          >
            Run your first scan now
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-zinc-500 text-xs mt-6">
            Takes under 2 minutes. No signup. No credit card.
          </p>
        </div>
      </div>
    </section>
  )
}
