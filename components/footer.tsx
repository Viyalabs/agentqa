import Link from 'next/link'
import { Separator } from './ui/separator'
import { Activity } from 'lucide-react'

const TECH_CREDITS = ['Playwright', 'Claude AI', 'Vercel', 'Supabase']

export function Footer() {
  return (
    <footer className="pt-14 pb-10 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto px-6">

        {/* Top grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-1.5">
              <Activity className="h-6 w-6 text-blue-400" />
              <span className="font-semibold text-xl text-white">AgentQA</span>
            </div>
            <p className="text-xs text-zinc-600 mb-4">by Praveen Kumar · Viyalabs · Chennai, India</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Automated QA testing for modern software teams.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Product</p>
            <nav className="space-y-3">
              <a href="#how-it-works" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">How it works</a>
              <a href="#pricing" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Pricing</a>
              <a href="#demo" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Live Demo</a>
              <Link href="/scans" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Recent Reports</Link>
              <Link href="/docs" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">API Docs</Link>
              <Link href="/changelog" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Changelog</Link>
            </nav>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Company</p>
            <nav className="space-y-3">
              <Link href="/about" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">About</Link>
              <Link href="/contact" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Contact</Link>
              <Link href="/privacy" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Privacy</Link>
              <Link href="/terms" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Terms</Link>
            </nav>
          </div>

          {/* Connect */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Connect</p>
            <nav className="space-y-3">
              <a
                href="https://x.com/Viyalabs"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                X / Twitter
              </a>
              <a
                href="https://www.linkedin.com/in/praveen-perfeito-75852a64/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com/Viyalabs/agentqa"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                GitHub
              </a>
              <a
                href="mailto:info@viyalabs.com"
                className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                info@viyalabs.com
              </a>
              <a
                href="https://share.google/qtFKmag7l8VFFIaEl"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Google Business
              </a>
              <a
                href="https://viyalabs.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                viyalabs.com
              </a>
            </nav>
          </div>
        </div>

        <Separator />

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 text-xs text-zinc-600">
          <p>© {new Date().getFullYear()} Viyalabs. All rights reserved.</p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-zinc-700">Built with</span>
            {TECH_CREDITS.map((tech, i) => (
              <span key={tech} className="flex items-center gap-2">
                {i > 0 && <span className="text-zinc-800">·</span>}
                <span className="text-zinc-500">{tech}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
