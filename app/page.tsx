import { Hero } from '@/components/hero'
import { Navbar } from '@/components/navbar'
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
import { AboutSection } from '@/components/about-section'

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

        {/* 2. Tool compatibility bar */}
        <TechBar />

        {/* 3. Live scan gallery — proof before explanation */}
        <RecentReports />

        {/* 4. Problem narrative + AI builders wedge */}
        <ProblemNarrative />

        {/* 5. How it works */}
        <HowItWorks />

        {/* 6. Traditional QA vs AgentQA */}
        <Comparison />

        {/* 7. Real report output */}
        <ReportPreview />

        {/* 8. Live demo scan */}
        <DemoScan />

        {/* 9. AI moat — root cause + fix centerpiece */}
        <AiMoat />

        {/* 10. Full feature set */}
        <Features />

        {/* 11. Social proof */}
        <Testimonials />

        {/* 12. CTA before pricing */}
        <CtaBanner />

        {/* 13. Pricing */}
        <Pricing />

        {/* 14. Company — legitimacy anchor before footer */}
        <AboutSection />
      </main>

      <Footer />
      <MobileCta />
    </div>
  )
}
