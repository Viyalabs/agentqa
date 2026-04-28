import { Hero } from '@/components/hero'
import { Navbar } from '@/components/navbar'
import { HowItWorks } from '@/components/how-it-works'
import { ReportPreview } from '@/components/report-preview'
import { DemoScan } from '@/components/demo-scan'
import { Features } from '@/components/features'
import { Pricing } from '@/components/pricing'
import { Footer } from '@/components/footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
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
