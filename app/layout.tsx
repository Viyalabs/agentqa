import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentqa.viyalabs.com'
const TITLE = 'AgentQA — AI Reliability Platform for Web Apps | Viyalabs'
const DESCRIPTION =
  'AgentQA by Viyalabs is the AI reliability platform for modern software teams. Automated QA on every deploy — real Chrome browser, regression detection, AI root cause analysis, and CI/CD integration. Built for SaaS startups, AI-generated apps, and engineering teams.'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: TITLE,
    template: '%s | AgentQA',
  },

  description: DESCRIPTION,

  keywords: [
    'AI reliability platform',
    'AI QA agent',
    'automated QA tool',
    'regression detection',
    'CI/CD QA integration',
    'automated regression testing',
    'AI app testing',
    'web app reliability',
    'Playwright testing',
    'bug detection',
    'AI generated app testing',
    'Cursor app testing',
    'Replit app testing',
    'Lovable app testing',
    'QA automation',
    'web app testing',
    'JavaScript error detection',
    'mobile responsiveness testing',
    'Viyalabs',
    'startup QA tool',
  ],

  authors: [
    { name: 'Praveen Kumar', url: 'https://www.linkedin.com/in/praveen-perfeito-75852a64/' },
    { name: 'Viyalabs', url: 'https://viyalabs.com' },
  ],
  creator: 'Praveen Kumar — Viyalabs',
  publisher: 'Viyalabs',

  alternates: {
    canonical: APP_URL,
  },

  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: APP_URL,
    siteName: 'AgentQA',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AgentQA — Automated QA for Web Apps',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
    creator: '@viyalabs',
    site: '@viyalabs',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  category: 'technology',
}

export const viewport: Viewport = {
  themeColor: '#0A0A0F',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
        <Analytics />
      </body>
    </html>
  )
}
