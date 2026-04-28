'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { validateUrl } from '@/lib/utils'

export function ScanForm() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const normalized = url.trim()

    // Add https:// if protocol is missing
    const toValidate =
      normalized.startsWith('http://') || normalized.startsWith('https://')
        ? normalized
        : `https://${normalized}`

    const { valid, error: validationError } = validateUrl(toValidate)
    if (!valid) {
      setError(validationError ?? 'Invalid URL')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: toValidate }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error ?? 'Failed to start scan. Please try again.')
          return
        }

        router.push(`/scan/${data.scanId}`)
      } catch {
        setError('Network error. Please check your connection and try again.')
      }
    })
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
              Starting scan…
            </>
          ) : (
            <>
              Scan My App Free
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-3 text-left">
        Example:{' '}
        <button
          type="button"
          className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
          onClick={() => setUrl('https://example.com')}
        >
          https://example.com
        </button>
      </p>
    </form>
  )
}
