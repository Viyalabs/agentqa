import { Hero } from '@/components/hero'
import { Navbar } from '@/components/navbar'
import { HowItWorks } from '@/components/how-it-works'
import { ReportPreview } from '@/components/report-preview'
import { DemoScan } from '@/components/demo-scan'
import { Features } from '@/components/features'
import { Pricing } from '@/components/pricing'
import { Footer } from '@/components/footer'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AgentQA',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  description:
    'AgentQA automatically tests your website or web app using a real browser, detects bugs, captures screenshots, finds JS errors, tests mobile responsiveness, and delivers a QA report in under 2 minutes.',
  url: 'https://qa.viyalabs.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  provider: {
    '@type': 'Organization',
    name: 'Viyalabs',
    url: 'https://viyalabs.com',
  },
  featureList: [
    'Automated website testing',
    'Real browser Playwright testing',
    'JavaScript error detection',
    'Mobile responsiveness testing',
    'Screenshot capture',
    'QA score report',
    'Bug detection',
    'Web app QA automation',
  ],
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      {/* Main content */}
      <main>
        <Hero />
        <HowItWorks />
        <ReportPreview />
        <DemoScan />
        <Features />
        <Pricing />
      </main>

      <Footer />
    </div>
  )
}
