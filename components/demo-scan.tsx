'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, ShoppingCart, BarChart3, Layout, AlertCircle } from 'lucide-react'

const DEMOS = [
  {
    label: 'SaaS App',
    url: 'https://vercel.com',
    description: 'Marketing site with pricing, docs, and dashboard links',
    icon: BarChart3,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40',
  },
  {
    label: 'E-commerce',
    url: 'https://demo.vercel.store',
    description: 'Next.js Commerce demo — product pages, cart, checkout',
    icon: ShoppingCart,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20 hover:border-green-500/40',
  },
  {
    label: 'Portfolio',
    url: 'https://nextjs.org',
    description: 'Documentation site with many pages and navigation links',
    icon: Layout,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/40',
  },
]

export function DemoScan() {
  const router = useRouter()
  const [activeUrl, setActiveUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function startScan(url: string) {
    setActiveUrl(url)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error ?? 'Failed to start scan. Please try again.')
          setActiveUrl(null)
          return
        }
        const dest = data.cached ? `/report/${data.scanId}` : `/scan/${data.scanId}`
        router.push(dest)
      } catch {
        setError('Network error. Please check your connection.')
        setActiveUrl(null)
      }
    })
  }

  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Live demo</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            See AgentQA run on a real site
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Pick any of these and watch the AI QA agent crawl, test, and report — live, in your browser, right now.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-6 text-sm text-red-400 justify-center">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          {DEMOS.map((demo) => {
            const isLoading = isPending && activeUrl === demo.url
            return (
              <button
                key={demo.url}
                onClick={() => startScan(demo.url)}
                disabled={isPending}
                className={`group relative text-left p-6 rounded-xl border transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${demo.bg}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-center">
                    <demo.icon className={`h-5 w-5 ${demo.color}`} />
                  </div>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 text-zinc-500 animate-spin" />
                  ) : (
                    <ArrowRight className={`h-4 w-4 ${demo.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  )}
                </div>

                <div className={`text-sm font-semibold mb-1 ${demo.color}`}>{demo.label}</div>
                <div className="text-xs font-mono text-zinc-500 mb-2 truncate">{demo.url}</div>
                <div className="text-xs text-zinc-400 leading-relaxed">{demo.description}</div>

                {isLoading && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-zinc-950/60">
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting scan…
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
