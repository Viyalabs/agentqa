'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { Button } from './ui/button'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? 'border-zinc-700/60 bg-[#0A0A0F]/90 backdrop-blur-xl shadow-lg shadow-black/20'
          : 'border-zinc-800/40 bg-[#0A0A0F]/70 backdrop-blur-md'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <a href="/" className="flex items-center gap-2.5 text-white font-semibold text-lg hover:opacity-90 transition-opacity">
          <Activity className="h-5 w-5 text-blue-400" />
          AgentQA
        </a>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-7 text-sm font-medium text-zinc-400">
          <a href="#how-it-works" className="hover:text-white transition-colors">
            How it works
          </a>
          <a href="#demo" className="hover:text-white transition-colors">
            Demo
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
          <a href="/patterns" className="hover:text-white transition-colors">
            Patterns
          </a>
          <a href="/docs" className="hover:text-white transition-colors">
            Docs
          </a>
          <a
            href="https://github.com/PraveenPerfeito/agentqa"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>

        {/* CTA — focuses the URL input directly */}
        <Button
          size="sm"
          className="shrink-0 hidden sm:inline-flex"
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>('#scan-form input[type="text"]')
            input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            input?.focus()
          }}
        >
          Scan My App Free
        </Button>

        {/* Mobile */}
        <Button
          size="sm"
          className="sm:hidden"
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>('#scan-form input[type="text"]')
            input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            input?.focus()
          }}
        >
          Scan My App Free
        </Button>
      </div>
    </nav>
  )
}
