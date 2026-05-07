import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy — AgentQA',
  description: 'How AgentQA collects, uses, and protects your data.',
  robots: { index: true },
}

const LAST_UPDATED = 'April 30, 2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Nav */}
      <nav className="border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-white hover:opacity-90 transition-opacity">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-4">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">Privacy Policy</h1>
        <p className="text-zinc-500 text-sm mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-zinc prose-invert max-w-none space-y-10 text-zinc-400 leading-relaxed">

          <Section title="Overview">
            AgentQA is a product by <a href="https://viyalabs.com" className="text-zinc-300 hover:text-white transition-colors">Viyalabs</a>. We take privacy seriously and keep what we collect to the minimum needed to run the product. We do not sell your data.
          </Section>

          <Section title="What we collect">
            <ul className="space-y-3 mt-3">
              <Li><strong className="text-zinc-300">URLs you scan.</strong> When you submit a URL, we store it in our database to run the scan and generate your report. Reports are accessible via a shareable link.</Li>
              <Li><strong className="text-zinc-300">Scan results.</strong> Issues found, screenshots, page status codes, JS errors, and network data collected during your scan are stored and displayed in your report.</Li>
              <Li><strong className="text-zinc-300">Email address (optional).</strong> If you request your report by email or join the Pro waitlist, we store your email address. This is entirely optional — you can use AgentQA without providing one.</Li>
              <Li><strong className="text-zinc-300">Usage data.</strong> We count aggregate scan volume and bug counts to display on the homepage. No individual usage is tracked beyond what's stored in your scan record.</Li>
            </ul>
          </Section>

          <Section title="How we use your data">
            <ul className="space-y-3 mt-3">
              <Li>To run your scan and serve your report.</Li>
              <Li>To email you a link to your report if you requested it.</Li>
              <Li>To notify you when AgentQA Pro launches, if you joined the waitlist.</Li>
              <Li>To improve the product — understanding what types of issues we detect most helps us build better tests.</Li>
            </ul>
            <p className="mt-4">We do not use your data for advertising. We do not share or sell it to third parties.</p>
          </Section>

          <Section title="Third-party services">
            <ul className="space-y-3 mt-3">
              <Li><strong className="text-zinc-300">Supabase</strong> — our database and storage provider. Scan data, results, and emails are stored here. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-white transition-colors">Supabase Privacy Policy</a>.</Li>
              <Li><strong className="text-zinc-300">Resend</strong> — transactional email. Used only to send report links and waitlist notifications. <a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-white transition-colors">Resend Privacy Policy</a>.</Li>
              <Li><strong className="text-zinc-300">Vercel</strong> — hosting. Standard request logs apply. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-white transition-colors">Vercel Privacy Policy</a>.</Li>
            </ul>
          </Section>

          <Section title="Data retention">
            Scan reports are retained indefinitely so shareable links remain valid. If you would like your scan data or email address deleted, contact us at{' '}
            <a href="mailto:support@viyalabs.com" className="text-zinc-300 hover:text-white transition-colors">support@viyalabs.com</a> and we will remove it within 7 days.
          </Section>

          <Section title="Cookies">
            AgentQA does not use cookies or tracking pixels. We do not run analytics scripts that track individual users across sessions.
          </Section>

          <Section title="Security">
            Scan data is stored in a PostgreSQL database with row-level security enabled. Access is restricted to the service role used by our backend. We use HTTPS for all data in transit.
          </Section>

          <Section title="Children">
            AgentQA is not directed at children under 13. We do not knowingly collect data from anyone under 13.
          </Section>

          <Section title="Changes">
            If we make material changes to this policy, we will update the date at the top of this page. Continued use of AgentQA after changes means you accept the updated policy.
          </Section>

          <Section title="Contact">
            Questions? Email us at{' '}
            <a href="mailto:support@viyalabs.com" className="text-zinc-300 hover:text-white transition-colors">support@viyalabs.com</a>
            {' '}or visit{' '}
            <a href="https://viyalabs.com" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-white transition-colors">viyalabs.com</a>.
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
      <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
      <div className="text-base text-zinc-400 leading-relaxed">{children}</div>
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
