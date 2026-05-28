import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service — AgentQA',
  description: 'Terms of service for AgentQA, an AI reliability platform by Viyalabs.',
  robots: { index: true },
}

const LAST_UPDATED = 'May 2026'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <nav className="border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2 font-semibold text-white hover:opacity-90 transition-opacity">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-4">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10 text-zinc-400 leading-relaxed text-sm">

          <Section title="Agreement">
            By using AgentQA (<a href="https://qa.viyalabs.com" className="text-zinc-300 hover:text-white transition-colors">qa.viyalabs.com</a>), you agree to these terms. AgentQA is a product of Viyalabs, based in Chennai, India.
          </Section>

          <Section title="What AgentQA does">
            AgentQA is an automated QA and reliability platform. It scans publicly accessible web applications using a real browser, detects issues, and generates reports with AI-powered analysis. You submit a URL; we test what&apos;s publicly accessible.
          </Section>

          <Section title="Acceptable use">
            <ul className="space-y-3 mt-3">
              <Li>You may only scan URLs you own or have explicit permission to test.</Li>
              <Li>You may not use AgentQA to scan third-party websites without authorization.</Li>
              <Li>You may not attempt to circumvent rate limits, attack our infrastructure, or use the service to facilitate unauthorized access to any system.</Li>
              <Li>AgentQA is a diagnostic tool. Reports are for informational purposes — we make no warranty that scans are exhaustive or that detected issues are the only issues present.</Li>
            </ul>
          </Section>

          <Section title="Free tier">
            The free tier is provided as-is, with no SLA or uptime guarantee. We reserve the right to modify scan limits, feature availability, or rate limits for free users at any time.
          </Section>

          <Section title="Intellectual property">
            Scan reports and outputs belong to you. AgentQA retains anonymized, aggregated data about issue patterns across all scans to improve the product and its AI reliability intelligence.
          </Section>

          <Section title="Limitation of liability">
            AgentQA is provided &ldquo;as is.&rdquo; Viyalabs is not liable for any damages arising from use of the service, missed bugs, false positives, or actions taken based on scan results. Your use of AgentQA is at your own discretion and risk.
          </Section>

          <Section title="Changes">
            We may update these terms as the product evolves. Material changes will be noted at the top of this page with an updated date. Continued use of AgentQA after changes constitutes acceptance of the updated terms.
          </Section>

          <Section title="Contact">
            Questions about these terms? Email{' '}
            <a href="mailto:info@viyalabs.com" className="text-zinc-300 hover:text-white transition-colors">
              info@viyalabs.com
            </a>
            {' '}or visit{' '}
            <a href="https://viyalabs.com" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-white transition-colors">
              viyalabs.com
            </a>.
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-zinc-800">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Back to AgentQA
          </Link>
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-zinc-400 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-zinc-600 mt-1 shrink-0">—</span>
      <span>{children}</span>
    </li>
  )
}
