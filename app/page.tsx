import { Hero } from '@/components/hero'
import { Navbar } from '@/components/navbar'
import { getHomeStats } from '@/lib/stats'
import { WhyAgentQA } from '@/components/why-agentqa'
import { DemoScan } from '@/components/demo-scan'
import { AiMoat } from '@/components/ai-moat'
import { Features } from '@/components/features'
import { RecentReports } from '@/components/recent-reports'
import { ReliabilityIntelligence } from '@/components/reliability-intelligence'
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
    'AgentQA is the AI reliability intelligence platform for modern software teams. Real browser testing, regression detection, and AI root cause analysis on every deploy.',
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
    'AI reliability intelligence',
    'Real browser testing with Playwright',
    'JavaScript error detection with stack traces',
    'Mobile responsiveness testing',
    'Regression detection across deploys',
    'AI root cause analysis with Claude',
    'Cross-scan failure pattern library',
    'CI/CD integration',
    'QA score report',
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
        {/* 1. Hero + audience segments */}
        <Hero stats={stats} />

        {/* 2. Live scan evidence — proof before explanation */}
        <RecentReports />

        {/* 3. The problem + direct comparison */}
        <WhyAgentQA />

        {/* 4. What it covers */}
        <Features />

        {/* 5. AI differentiation — root cause + pattern intelligence */}
        <AiMoat />

        {/* 6. The moat — live pattern data */}
        <ReliabilityIntelligence />

        {/* 7. Try it live */}
        <DemoScan />

        {/* 8. Pricing */}
        <Pricing />

        {/* 9. Close */}
        <CtaBanner />
      </main>

      <Footer />
      <MobileCta />
    </div>
  )
}
