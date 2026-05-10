import { Hero } from '@/components/hero'
import { Navbar } from '@/components/navbar'
import { getHomeStats } from '@/lib/stats'
import { ProblemNarrative } from '@/components/problem-narrative'
import { HowItWorks } from '@/components/how-it-works'
import { Comparison } from '@/components/comparison'
import { ReportPreview } from '@/components/report-preview'
import { DemoScan } from '@/components/demo-scan'
import { AiMoat } from '@/components/ai-moat'
import { Testimonials } from '@/components/testimonials'
import { TechBar } from '@/components/tech-bar'
import { Features } from '@/components/features'
import { RecentReports } from '@/components/recent-reports'
import { CtaBanner } from '@/components/cta-banner'
import { Pricing } from '@/components/pricing'
import { Footer } from '@/components/footer'
import { MobileCta } from '@/components/mobile-cta'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AgentQA',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  description:
    'AgentQA is an autonomous AI QA agent that tests your web app using a real browser, detects bugs, captures screenshots, finds JS errors, tests mobile responsiveness, and delivers a QA report in under 2 minutes.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentqa.viyalabs.com',
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

export const revalidate = 3600

export default async function HomePage() {
  const stats = await getHomeStats()

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main>
        {/* 1. Hero + Who Is This For */}
        <Hero stats={stats} />

        {/* 2. Tool compatibility bar */}
        <TechBar />

        {/* 3. Problem narrative + AI builders wedge */}
        <ProblemNarrative />

        {/* 4. How it works */}
        <HowItWorks />

        {/* 5. Traditional QA vs AgentQA */}
        <Comparison />

        {/* 6. Real report output */}
        <ReportPreview />

        {/* 7. Live demo scan */}
        <DemoScan />

        {/* 8. AI moat — root cause + fix centerpiece */}
        <AiMoat />

        {/* 9. Full feature set */}
        <Features />

        {/* 10. Social proof */}
        <Testimonials />

        {/* 11. Live scan gallery */}
        <RecentReports />

        {/* 12. CTA before pricing */}
        <CtaBanner />

        {/* 13. Pricing */}
        <Pricing />
      </main>

      <Footer />
      <MobileCta />
    </div>
  )
}
