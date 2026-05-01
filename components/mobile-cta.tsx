'use client'

import { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'

export function MobileCta() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const check = () => setVisible(window.scrollY > 420)
    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [])

  function scrollToForm() {
    const input = document.querySelector<HTMLInputElement>('#scan-form input[type="text"]')
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    input?.focus()
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-zinc-800/80 bg-[#0A0A0F]/95 backdrop-blur-md px-4 py-3 safe-b">
      <button
        onClick={scrollToForm}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-sm transition-all"
      >
        Scan My App Free
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}
