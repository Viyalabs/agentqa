import { Separator } from './ui/separator'
import { Activity } from 'lucide-react'

export function Footer() {
  return (
    <footer className="py-12 px-4 border-t border-zinc-800">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span className="font-bold text-white">AgentQA</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center gap-6 text-sm text-zinc-500">
            <a href="#how-it-works" className="hover:text-zinc-300 focus-visible:text-zinc-300 transition-colors">
              How it works
            </a>
            <a href="#pricing" className="hover:text-zinc-300 focus-visible:text-zinc-300 transition-colors">
              Pricing
            </a>
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
            A product by{' '}
            <a
              href="https://viyalabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors font-medium"
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
