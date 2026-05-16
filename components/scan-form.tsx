'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, AlertCircle, Mail, Zap, RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { validateUrl } from '@/lib/utils'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 minute ago'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.floor(mins / 60)
  return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`
}

interface CachedScan {
  scanId: string
  completedAt: string
  url: string
}

export function ScanForm() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [email, setEmail] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [cachedScan, setCachedScan] = useState<CachedScan | null>(null)
  const [isPending, startTransition] = useTransition()

  const doScan = useCallback((urlStr: string, forceRescan: boolean) => {
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = { url: urlStr, email: email.trim() || undefined }
        if (forceRescan) body.forceRescan = true

        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const data = await res.json()

        if (!res.ok) {
          const msg: string = data.error ?? 'Failed to start scan. Please try again.'
          if (res.status === 429 && msg.toLowerCase().includes('too many')) {
            setIsRateLimited(true)
          } else {
            setError(msg)
          }
          return
        }

        if (data.cached) {
          if (data.running) {
            // In-progress scan — join the existing progress page
            router.push(`/scan/${data.scanId}`)
            return
          }
          // Completed scan — surface the choice to the user
          setCachedScan({ scanId: data.scanId, completedAt: data.completedAt, url: urlStr })
          return
        }

        try {
          localStorage.setItem('aqLastScan', JSON.stringify({ url: urlStr, scanId: data.scanId, ts: Date.now() }))
        } catch { /* ok */ }

        router.push(`/scan/${data.scanId}`)
      } catch {
        setError('Network error. Please check your connection and try again.')
      }
    })
  }, [email, router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsRateLimited(false)
    setCachedScan(null)

    const normalized = url.trim()
    const toValidate =
      normalized.startsWith('http://') || normalized.startsWith('https://')
        ? normalized
        : `https://${normalized}`

    const { valid, error: validationError } = validateUrl(toValidate)
    if (!valid) {
      setError(validationError ?? 'Invalid URL')
      return
    }

    doScan(toValidate, false)
  }

  return (
    <form id="scan-form" onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="https://your-app.vercel.app"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError(null)
              if (isRateLimited) setIsRateLimited(false)
              if (cachedScan) setCachedScan(null)
            }}
            disabled={isPending}
            className="h-12 text-base pr-4 bg-zinc-900/80 border-zinc-700 focus:border-blue-500"
            aria-label="Website URL to scan"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !url.trim()}
          className="h-12 px-6 shrink-0"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              Scan My App Free
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* Optional email — revealed on demand */}
      {showEmail ? (
        <div className="mt-3 flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <Input
            type="email"
            placeholder="you@company.com — get the report by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            className="h-9 text-sm bg-zinc-900/60 border-zinc-700 focus:border-blue-500"
            aria-label="Email address for report delivery"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowEmail(true)}
          className="mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1.5"
        >
          <Mail className="h-3 w-3" />
          Email me the report
        </button>
      )}

      {/* Recent scan found — let user choose between report and fresh scan */}
      {cachedScan && (
        <div className="mt-3 rounded-xl border border-zinc-700/70 bg-zinc-900/50 p-4">
          <p className="text-sm font-medium text-zinc-200 mb-0.5">Recent scan found</p>
          <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
            This URL was scanned {timeAgo(cachedScan.completedAt)}. Results may not reflect recent changes.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => router.push(`/report/${cachedScan.scanId}`)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-zinc-600 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View latest report
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setCachedScan(null)
                doScan(cachedScan.url, true)
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              Run fresh scan
            </button>
          </div>
        </div>
      )}

      {isRateLimited && (
        <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300 mb-0.5">Scan limit reached</p>
              <p className="text-xs text-amber-500/80 leading-relaxed">
                Free tier allows 3 scans per hour. Your limit resets automatically — or get unlimited scans with Pro.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors"
                >
                  View Pro plans →
                </button>
                <span className="text-amber-600 text-xs">or wait ~1 hour and try again</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-3 text-left">
        Try a demo:{' '}
        {[
          { label: 'ycombinator.com', url: 'https://ycombinator.com' },
          { label: 'producthunt.com', url: 'https://producthunt.com' },
          { label: 'stripe.com', url: 'https://stripe.com' },
        ].map((demo, i) => (
          <span key={demo.url}>
            {i > 0 && <span className="mx-1 text-zinc-700">·</span>}
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
              onClick={() => { setUrl(demo.url); if (error) setError(null); if (cachedScan) setCachedScan(null) }}
            >
              {demo.label}
            </button>
          </span>
        ))}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
        <span className="text-xs text-zinc-500">You&apos;ll get:</span>
        {['QA Score', 'Screenshots', 'JS + Network', 'Accessibility', 'SEO Checks', 'AI Fix'].map((item) => (
          <span
            key={item}
            className="text-xs px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-500"
          >
            {item}
          </span>
        ))}
      </div>
    </form>
  )
}
