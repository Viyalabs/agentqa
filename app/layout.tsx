import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const APP_URL = 'https://qa.viyalabs.com'
const TITLE = 'AgentQA — Catch Bugs Before Your Users Do'
const DESCRIPTION =
  'AgentQA automatically tests your website or web app using a real browser, detects bugs, captures screenshots, finds JS errors, tests mobile responsiveness, and delivers a QA report in under 2 minutes.'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: TITLE,
    template: '%s | AgentQA',
  },

  description: DESCRIPTION,

  keywords: [
    'AI app testing',
    'website testing',
    'automated QA',
    'Playwright testing',
    'bug detection',
    'AI generated apps',
    'website scanner',
    'QA automation',
    'web app testing',
    'automated website testing',
    'web app QA',
    'JavaScript error detection',
    'mobile responsiveness testing',
  ],

  authors: [{ name: 'Viyalabs', url: 'https://viyalabs.com' }],
  creator: 'Viyalabs',
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
      </body>
    </html>
  )
}
