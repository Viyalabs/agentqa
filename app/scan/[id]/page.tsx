import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ArrowLeft } from 'lucide-react'
import { ResultsDashboard } from '@/components/results-dashboard'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Scan ${id.slice(0, 8)} — QA Report`,
    robots: { index: false },
  }
}

export default async function ScanResultsPage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
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
