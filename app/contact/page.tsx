import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, Mail, Github, Globe, MapPin, Twitter, Linkedin, Building2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact — AgentQA',
  description: 'Get in touch with the AgentQA team at Viyalabs. Questions, partnership inquiries, or feedback.',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Activity className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-white">AgentQA</span>
            <span className="text-xs text-zinc-600 font-normal hidden md:inline ml-0.5">by Viyalabs</span>
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
            ← Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-4">Contact</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">Get in touch</h1>
        <p className="text-zinc-400 mb-12 leading-relaxed">
          Questions about AgentQA, partnership inquiries, or feedback — we read everything and respond within 24 hours.
        </p>

        <div className="space-y-4 mb-12">
          <a
            href="https://x.com/Viyalabs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <Twitter className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm group-hover:text-zinc-300 transition-colors">@Viyalabs on X</p>
              <p className="text-zinc-500 text-xs mt-0.5">Updates, releases, and product news</p>
            </div>
          </a>

          <a
            href="https://www.linkedin.com/in/praveen-perfeito-75852a64/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <Linkedin className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm group-hover:text-zinc-300 transition-colors">Praveen Kumar — LinkedIn</p>
              <p className="text-zinc-500 text-xs mt-0.5">Founder profile</p>
            </div>
          </a>

          <a
            href="https://share.google/qtFKmag7l8VFFIaEl"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-zinc-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm group-hover:text-zinc-300 transition-colors">Viyalabs on Google</p>
              <p className="text-zinc-500 text-xs mt-0.5">Google Business profile</p>
            </div>
          </a>

          <a
            href="mailto:info@viyalabs.com"
            className="flex items-center gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm group-hover:text-blue-300 transition-colors">info@viyalabs.com</p>
              <p className="text-zinc-500 text-xs mt-0.5">General questions, support, feedback</p>
            </div>
          </a>

          <a
            href="https://github.com/Viyalabs/agentqa"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <Github className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm group-hover:text-zinc-300 transition-colors">GitHub — Viyalabs/agentqa</p>
              <p className="text-zinc-500 text-xs mt-0.5">Bug reports, feature requests, open source</p>
            </div>
          </a>

          <a
            href="https://viyalabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-zinc-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm group-hover:text-zinc-300 transition-colors">viyalabs.com</p>
              <p className="text-zinc-500 text-xs mt-0.5">Company website</p>
            </div>
          </a>
        </div>

        {/* Founder */}
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 mb-4">
          <p className="text-xs text-zinc-600 uppercase tracking-wider font-mono mb-4">Built by</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold select-none">
              P
            </div>
            <div>
              <p className="text-white font-semibold">Praveen Kumar</p>
              <p className="text-zinc-500 text-sm mt-0.5">Founder, Viyalabs</p>
            </div>
          </div>
        </div>

        {/* Company */}
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-3.5 w-3.5 text-zinc-600" />
            <span className="text-xs text-zinc-600 uppercase tracking-wider font-mono">Headquarters</span>
          </div>
          <p className="text-white font-semibold">Viyalabs</p>
          <p className="text-zinc-400 text-sm mt-0.5">Chennai, Tamil Nadu, India</p>
          <p className="text-zinc-600 text-xs mt-2">AgentQA is a product of Viyalabs</p>
        </div>
      </main>

      <footer className="border-t border-zinc-800 mt-8 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <span>© {new Date().getFullYear()} Viyalabs. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
            <Link href="/about" className="hover:text-zinc-400 transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
