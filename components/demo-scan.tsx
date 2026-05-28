'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, AlertCircle, Layers, Hash, TrendingUp } from 'lucide-react'

// Resolved at build time — points to /demo-app on whichever domain is deployed
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentqa.viyalabs.com'

const DEMOS = [
  {
    label: 'AI-Built SaaS App',
    url: `${APP_URL}/demo-app`,
    description: 'A realistic AI-generated dashboard with seeded issues — guaranteed findings every scan',
    icon: Layers,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40',
    badge: 'Recommended',
  },
  {
    label: 'Minimal HTML Site',
    url: 'https://news.ycombinator.com',
    description: 'Classic forum — tests SEO meta, OG image, accessibility, and core page health',
    icon: Hash,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20 hover:border-orange-500/40',
    badge: null,
  },
  {
    label: 'React SaaS Platform',
    url: 'https://www.producthunt.com',
    description: 'JS-heavy product platform — dynamic content, image loading, mobile layout detection',
    icon: TrendingUp,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20 hover:border-green-500/40',
    badge: null,
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
    <section className="py-20 border-t border-zinc-800/40" id="demo">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Live demo</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            See AgentQA run on a real site
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl mx-auto mb-4">
            Pick a site below — AgentQA runs the exact same scan your users trigger. Real browser, live results, real findings.
          </p>
          <p className="text-xs text-zinc-500">
            ~90 seconds · Real Chrome browser · Publicly accessible sites only
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-6 text-sm text-red-400 justify-center">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-6">
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
                  <div className="flex items-center gap-2">
                    {demo.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold uppercase tracking-wide">
                        {demo.badge}
                      </span>
                    )}
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 text-zinc-500 animate-spin" />
                    ) : (
                      <ArrowRight className={`h-4 w-4 ${demo.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    )}
                  </div>
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
