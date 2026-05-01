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
    <section className="py-16 border-t border-blue-500/15 bg-blue-950/10">
      <div className="max-w-6xl mx-auto px-6">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-4">Free forever · No credit card</p>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-5">
          Your app has bugs.
          <br />
          <span className="text-zinc-500">Find them before your users do.</span>
        </h2>
        <p className="text-base text-zinc-400 leading-relaxed mb-8 max-w-xl mx-auto">
          Most broken pages are never found by the team that built them — they&apos;re found by users. One URL. 90 seconds. Know exactly what&apos;s broken.
        </p>
        <Button
          size="lg"
          className="gap-2 text-base px-8 h-12"
          onClick={focusScanInput}
        >
          Scan My App Free
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-zinc-700 text-xs mt-6">
          No credit card. No sign-up. No setup. Just paste a URL.
        </p>
      </div>
      </div>
    </section>
  )
}
