import { Activity } from 'lucide-react'
import { Hero } from '@/components/hero'
import { HowItWorks } from '@/components/how-it-works'
import { ReportPreview } from '@/components/report-preview'
import { DemoScan } from '@/components/demo-scan'
import { Features } from '@/components/features'
import { Pricing } from '@/components/pricing'
import { Footer } from '@/components/footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800/50 bg-[#0A0A0F]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-bold text-white">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </a>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <a href="#how-it-works" className="hover:text-zinc-200 transition-colors hidden sm:block">
              How it works
            </a>
            <a href="#pricing" className="hover:text-zinc-200 transition-colors hidden sm:block">
              Pricing
            </a>
          </div>
        </div>
      </nav>

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
