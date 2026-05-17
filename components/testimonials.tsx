const TESTIMONIALS = [
  {
    quote:
      "Handed off a project with an AgentQA report attached. Client asked if we had a dedicated QA team. We don't.",
    author: 'Sophie M.',
    role: 'Founder, dev studio',
    initials: 'SM',
    detail: 'Runs on every client delivery',
  },
  {
    quote:
      "30 minutes before my launch email. AgentQA found a broken auth redirect — new users would have hit a blank screen. Caught it. Fixed it. Sent the email.",
    author: 'Marcus Chen',
    role: 'Solo founder, B2B SaaS',
    initials: 'MC',
    detail: '2 critical bugs caught pre-launch',
  },
]

export function Testimonials() {
  return (
    <section className="py-20 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Early access</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            From the first people who used it
          </h2>
          <p className="text-base text-zinc-400 max-w-md mx-auto leading-relaxed">
            Early access users — unfiltered.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.initials}
              className="flex flex-col p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-200"
            >
              <svg className="h-5 w-5 text-zinc-600 mb-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <p className="text-base text-zinc-300 leading-relaxed flex-1 mb-5">
                {t.quote}
              </p>
              <div className="border-t border-zinc-800 pt-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-zinc-400">{t.initials}</span>
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{t.author}</div>
                    <div className="text-zinc-500 text-xs">{t.role}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-zinc-500 bg-zinc-800/60 px-2 py-1 rounded">
                  {t.detail}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-5 rounded-xl border border-dashed border-zinc-800 text-center">
          <p className="text-sm text-zinc-500">
            More stories coming as we grow.{' '}
            <a
              href="mailto:support@viyalabs.com"
              className="text-blue-400/80 hover:text-blue-400 transition-colors"
            >
              Share yours →
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
