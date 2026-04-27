import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'AgentQA — Automated QA for AI-built Apps',
    template: '%s | AgentQA',
  },
  description:
    'AgentQA crawls your deployed web app, runs real browser tests, detects failures, captures screenshots, and gives you an actionable QA report in under 2 minutes.',
  keywords: ['QA', 'testing', 'AI', 'web app', 'Playwright', 'automated testing'],
  openGraph: {
    title: 'AgentQA — Automated QA for AI-built Apps',
    description: 'Ship AI apps with confidence. Automated QA in under 2 minutes.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  )
}
