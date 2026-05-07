'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ReportError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Failed to load report</h2>
        <p className="text-zinc-400 text-sm mb-6">
          This report couldn't be loaded. The scan may have failed to complete, or the report ID is invalid.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <span className="text-zinc-700">·</span>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
            New scan
          </Link>
        </div>
      </div>
    </div>
  )
}
