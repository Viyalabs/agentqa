'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { getScoreColor, truncateUrl } from '@/lib/utils'

interface RecentScan {
  id: string
  url: string
  score: number | null
  total_issues: number
  completed_at: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function RecentScansStrip() {
  const [scans, setScans] = useState<RecentScan[]>([])

  useEffect(() => {
    fetch('/api/recent-scans')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.scans)) setScans(data.scans) })
      .catch(() => {})
  }, [])

  if (scans.length === 0) return null

  return (
    <div className="mt-6 pt-5 border-t border-zinc-800/50">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Recently scanned</span>
      </div>
      <div className="space-y-1.5">
        {scans.map((scan) => {
          let host = scan.url
          try { host = new URL(scan.url).hostname.replace(/^www\./, '') } catch { /* ok */ }

          return (
            <Link
              key={scan.id}
              href={`/report/${scan.id}`}
              className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-zinc-800/40 transition-colors group"
            >
              <Activity className="h-3 w-3 text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors" />
              <span className="flex-1 text-xs text-zinc-500 group-hover:text-zinc-300 font-mono truncate transition-colors">
                {truncateUrl(host, 35)}
              </span>
              {scan.score !== null && (
                <span className={`text-xs font-mono font-semibold tabular-nums ${getScoreColor(scan.score)}`}>
                  {scan.score}
                </span>
              )}
              <span className="text-[10px] text-zinc-500 shrink-0 tabular-nums">
                {timeAgo(scan.completed_at)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
