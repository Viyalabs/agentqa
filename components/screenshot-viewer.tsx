'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Camera, ExternalLink, X, CheckCircle, XCircle } from 'lucide-react'
import type { ScannedPage } from '@/types'
import { truncateUrl, formatDuration } from '@/lib/utils'

interface ScreenshotViewerProps {
  pages: ScannedPage[]
}

export function ScreenshotViewer({ pages }: ScreenshotViewerProps) {
  const [selectedPage, setSelectedPage] = useState<ScannedPage | null>(null)

  const pagesWithScreenshots = pages.filter((p) => p.screenshot_url)

  if (pagesWithScreenshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
        <Camera className="h-8 w-8 mb-3 opacity-50" />
        <p className="text-sm">No screenshots captured yet</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pagesWithScreenshots.map((page) => (
          <button
            key={page.id}
            onClick={() => setSelectedPage(page)}
            className="group relative rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all bg-zinc-950 text-left"
          >
            {/* Screenshot */}
            <div className="relative aspect-video bg-zinc-900">
              {page.screenshot_url ? (
                <Image
                  src={page.screenshot_url}
                  alt={`Screenshot of ${page.url}`}
                  fill
                  className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-200"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Camera className="h-6 w-6 text-zinc-700" />
                </div>
              )}

              {/* Status overlay */}
              <div className="absolute top-2 right-2">
                {page.status_code === 200 ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-950/80 border border-green-500/30 text-green-400 text-xs font-mono">
                    <CheckCircle className="h-3 w-3" />
                    200
                  </div>
                ) : page.status_code ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/30 text-red-400 text-xs font-mono">
                    <XCircle className="h-3 w-3" />
                    {page.status_code}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Page info */}
            <div className="p-3">
              <p className="text-xs text-zinc-300 font-medium truncate">
                {truncateUrl(page.url, 40)}
              </p>
              <div className="flex items-center gap-3 mt-1">
                {page.load_time_ms && (
                  <span className="text-xs text-zinc-600">
                    {formatDuration(page.load_time_ms)}
                  </span>
                )}
                {page.has_console_errors && (
                  <span className="text-xs text-red-500">Errors</span>
                )}
                {page.has_network_failures && (
                  <span className="text-xs text-yellow-500">Net failures</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox modal */}
      {selectedPage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedPage(null)}
        >
          <div
            className="relative w-full max-w-5xl bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                {selectedPage.status_code === 200 ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <span className="text-sm text-zinc-300 font-mono truncate max-w-md">
                  {selectedPage.url}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={selectedPage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Open page"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => setSelectedPage(null)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Full screenshot */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              {selectedPage.screenshot_url && (
                <Image
                  src={selectedPage.screenshot_url}
                  alt={`Screenshot of ${selectedPage.url}`}
                  fill
                  className="object-cover object-top"
                  sizes="90vw"
                />
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-6 p-4 border-t border-zinc-800 text-xs text-zinc-500">
              {selectedPage.title && <span>Title: {selectedPage.title}</span>}
              {selectedPage.load_time_ms && (
                <span>Load time: {formatDuration(selectedPage.load_time_ms)}</span>
              )}
              {selectedPage.status_code && (
                <span>Status: {selectedPage.status_code}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
