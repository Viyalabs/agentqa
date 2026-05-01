import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ArrowLeft } from 'lucide-react'
import { ResultsDashboard } from '@/components/results-dashboard'
import { getAdminClient } from '@/lib/supabase'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  try {
    const db = getAdminClient()
    const { data: scan } = await db
      .from('scans')
      .select('url, score, total_issues')
      .eq('id', id)
      .single()

    if (scan) {
      let displayHost = scan.url
      try { displayHost = new URL(scan.url).hostname.replace(/^www\./, '') } catch { /* ok */ }
      const scoreText = scan.score !== null ? ` — Score ${scan.score}/100` : ''
      const issueText = scan.total_issues > 0 ? ` · ${scan.total_issues} issues found` : ' · No issues found'
      return {
        title: `QA Report: ${displayHost}${scoreText} | AgentQA`,
        description: `AgentQA scanned ${displayHost}${scoreText}${issueText}. Real browser QA testing — no setup required.`,
        openGraph: {
          title: `QA Report: ${displayHost}${scoreText}`,
          description: `${scan.total_issues} issue${scan.total_issues !== 1 ? 's' : ''} found. See the full AI-powered QA report.`,
        },
      }
    }
  } catch { /* fallback below */ }

  return {
    title: `QA Report — AgentQA`,
    description: 'Automated QA report — real browser testing, QA score, screenshots, and issue breakdown.',
  }
}

/**
 * Public shareable report page — same report view as /scan/[id] but served
 * at /report/[id] so shared links look intentional and clean.
 */
export default async function ReportPage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <nav className="sticky top-0 z-40 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Scan your app free
          </Link>
        </div>
      </nav>

      <main className="py-6">
        <ResultsDashboard scanId={id} />
      </main>
    </div>
  )
}
