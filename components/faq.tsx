'use client'

import { useState } from 'react'
import { ChevronDown, ArrowRight } from 'lucide-react'

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
    q: 'What exactly does it catch?',
    a: 'JS exceptions with full stack traces, failed API requests (4xx / 5xx), broken images, horizontal overflow at 375 px mobile, pages loading over 5 seconds, assets over 500 KB, 404 and 5xx page errors — all severity-classified as Critical, Medium, or Low. Plus AI root-cause and fix on every issue.',
  },
  {
    q: 'How many pages can it scan?',
    a: 'Free tier: up to 5 pages per scan, tested on desktop and mobile. Pro (early access, $49/mo) removes the limit entirely — scan as many pages as your app has.',
  },
  {
    q: 'Is it really free? What\'s the catch?',
    a: 'No catch. Free means no credit card, no expiry, no watermarked reports. You get a real Chrome browser scan, AI analysis, and a permanent shareable report link — free forever. Pro adds unlimited pages, CI/CD integration, and team features.',
  },
  {
    q: 'Which frameworks and stacks does it support?',
    a: 'Any web app accessible via a public URL. React, Next.js, Vue, SvelteKit, Remix, plain HTML — it doesn\'t matter. If a browser can open it, AgentQA can test it. Works with apps deployed on Vercel, Netlify, Railway, Render, or any host.',
  },
  {
    q: 'How long does a scan take?',
    a: 'Typically 60–120 seconds for 5 pages. The exact time depends on page count and how fast your server responds. You\'ll see live progress as each page is crawled, and you can optionally get an email when the report is ready.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="py-16 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Common questions
            </h2>
            <p className="text-zinc-400">
              Everything you need to know before running your first scan.
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
                  <span className="text-white font-medium text-sm leading-snug">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-500 shrink-0 transition-transform duration-200 ${
                      open === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {open === i && (
                  <div className="px-5 pb-5">
                    <p className="text-zinc-400 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-zinc-800/60 text-center">
            <p className="text-zinc-400 text-sm mb-4">
              Still unsure? Just try it — takes 90 seconds, no account needed.
            </p>
            <a
              href="#scan-form"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
            >
              Scan My App Free
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
