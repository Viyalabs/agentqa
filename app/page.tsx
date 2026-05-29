import { Hero } from '@/components/hero'
import { Navbar } from '@/components/navbar'
import { getHomeStats } from '@/lib/stats'
import { WhyAgentQA } from '@/components/why-agentqa'
import { HowItWorks } from '@/components/how-it-works'
import { DemoScan } from '@/components/demo-scan'
import { AiMoat } from '@/components/ai-moat'
import { Features } from '@/components/features'
import { RecentReports } from '@/components/recent-reports'
import { ReliabilityIntelligence } from '@/components/reliability-intelligence'
import { CtaBanner } from '@/components/cta-banner'
import { Pricing } from '@/components/pricing'
import { Footer } from '@/components/footer'
import { MobileCta } from '@/components/mobile-cta'
import { AboutSection } from '@/components/about-section'
import { WhyNow } from '@/components/why-now'

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

        {/* 2. Live scan gallery */}
        <RecentReports />

        {/* 3. Why AgentQA — problem + comparison */}
        <WhyAgentQA />

        {/* 4b. Why now — market timing & investor narrative */}
        <WhyNow />

        {/* 4. How it works */}
        <HowItWorks />

        {/* 5. Live demo scan */}
        <DemoScan />

        {/* 6. AI moat — root cause + fix */}
        <AiMoat />

        {/* 7. Full feature set */}
        <Features />

        {/* 8. Reliability intelligence */}
        <ReliabilityIntelligence />

        {/* 9. CTA */}
        <CtaBanner />

        {/* 10. Pricing */}
        <Pricing />

        {/* 11. Company */}
        <AboutSection />
      </main>

      <Footer />
      <MobileCta />
    </div>
  )
}
