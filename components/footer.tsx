import Link from 'next/link'
import { Separator } from './ui/separator'
import { Activity } from 'lucide-react'

export function Footer() {
  return (
    <footer className="py-16 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-10">
          {/* Logo + tagline */}
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Activity className="h-5 w-5 text-blue-400" />
              <span className="font-bold text-lg text-white">AgentQA</span>
            </div>
            <p className="text-xs text-zinc-600 pl-0.5">The AI QA engineer for your app</p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center gap-7 text-sm font-medium text-zinc-500">
            <a href="#how-it-works" className="hover:text-zinc-300 focus-visible:text-zinc-300 transition-colors">
              How it works
            </a>
            <a href="#pricing" className="hover:text-zinc-300 focus-visible:text-zinc-300 transition-colors">
              Pricing
            </a>
            <Link href="/scans" className="hover:text-zinc-300 focus-visible:text-zinc-300 transition-colors">
              Recent Scans
            </Link>
            <Link href="/docs" className="hover:text-zinc-300 focus-visible:text-zinc-300 transition-colors">
              API Docs
            </Link>
            <Link href="/privacy" className="hover:text-zinc-300 focus-visible:text-zinc-300 transition-colors">
              Privacy
            </Link>
            <a
              href="https://github.com/PraveenPerfeito/agentqa"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 focus-visible:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>

        <Separator />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 text-xs text-zinc-600">
          <p>© {new Date().getFullYear()} AgentQA. All rights reserved.</p>
          <p>
            Built by{' '}
            <a
              href="https://viyalabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors font-medium underline underline-offset-2"
            >
              Viyalabs
            </a>
            {' '}·{' '}
            <a
              href="mailto:support@viyalabs.com"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              support@viyalabs.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
