import Link from 'next/link'
import { Activity } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      <nav className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-white hover:opacity-90 transition-opacity">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-4">404</p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-4">Page not found</h1>
        <p className="text-base text-zinc-400 leading-relaxed mb-10 max-w-md">
          This page doesn&apos;t exist — but your next QA report does.
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
        >
          Scan My App Free
        </Link>
      </main>
    </div>
  )
}
