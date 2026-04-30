import { Hero } from '@/components/hero'
import { Navbar } from '@/components/navbar'
import { ProblemNarrative } from '@/components/problem-narrative'
import { HowItWorks } from '@/components/how-it-works'
import { Comparison } from '@/components/comparison'
import { ReportPreview } from '@/components/report-preview'
import { DemoScan } from '@/components/demo-scan'
import { Features } from '@/components/features'
import { FutureOfQA } from '@/components/future-of-qa'
import { CtaBanner } from '@/components/cta-banner'
import { Pricing } from '@/components/pricing'
import { Footer } from '@/components/footer'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AgentQA',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  description:
    'AgentQA is an autonomous AI QA agent that tests your web app using a real browser, detects bugs, captures screenshots, finds JS errors, tests mobile responsiveness, and delivers a QA report in under 2 minutes.',
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
    'Autonomous AI QA agent',
    'Automated website testing',
    'Real browser Playwright testing',
    'JavaScript error detection',
    'Mobile responsiveness testing',
    'Screenshot capture',
    'QA score report',
    'Bug detection',
    'No setup required',
    'Works with Cursor, Replit, Lovable',
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

      <main>
        {/* 1. Hero + Who Is This For */}
        <Hero />

        {/* 2. Problem narrative + AI builders wedge */}
        <ProblemNarrative />

        {/* 3. How it works */}
        <HowItWorks />

        {/* 4. Traditional QA vs AgentQA */}
        <Comparison />

        {/* 5. Real report output */}
        <ReportPreview />

        {/* 6. Live demo scan */}
        <DemoScan />

        {/* 7. Full feature set */}
        <Features />

        {/* 8. Vision: Today / Next / Soon */}
        <FutureOfQA />

        {/* 9. CTA before pricing */}
        <CtaBanner />

        {/* 10. Pricing */}
        <Pricing />
      </main>

      <Footer />
    </div>
  )
}
