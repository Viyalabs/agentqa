'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'How is AgentQA different from Cypress or Playwright?',
    a: 'Cypress and Playwright require you to write and maintain test scripts — code that breaks every time your UI changes. AgentQA needs no code at all. Paste a URL, and it autonomously crawls every page, runs checks, and explains what it found. Zero scripts. Zero maintenance.',
  },
  {
    q: 'Does it work with apps that require login?',
    a: 'AgentQA currently tests publicly accessible pages — no login flows. It catches the bugs users hit before they even sign up: broken pages, JS crashes, mobile layout failures, slow loads, and bad API responses. Login-protected flows are on the roadmap.',
  },
  {
    q: "Is it really free? What's the catch?",
    a: 'No catch. Free means no credit card, no expiry, no watermarked reports. You get a real Chrome browser scan, AI analysis, and a permanent shareable report link — free forever. Pro adds unlimited pages, CI/CD integration, and team features.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="py-20 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
              Common questions
            </h2>
            <p className="text-base text-zinc-400 leading-relaxed">
              Quick answers before you run your first scan.
            </p>
          </div>

          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-zinc-900/60 transition-colors"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                >
                  <span className="text-white font-semibold text-base leading-snug">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-500 shrink-0 transition-transform duration-200 ${
                      open === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {open === i && (
                  <div className="px-5 pb-5">
                    <p className="text-base text-zinc-400 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
