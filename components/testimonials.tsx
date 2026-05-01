const TESTIMONIALS = [
  {
    quote:
      "I was 30 minutes from sending a launch email to 500 subscribers. Ran AgentQA on a whim. It found a broken auth redirect — new users would hit a blank screen instead of onboarding. Also caught a 404 on /pricing that I'd broken the day before. Fixed both in 20 minutes. I genuinely don't want to think about what that launch would have looked like.",
    author: 'Marcus Chen',
    role: 'Solo founder · B2B SaaS built with Cursor',
    initials: 'MC',
    detail: '3 pages scanned · 2 critical bugs caught · launch saved',
    featured: true,
  },
  {
    quote:
      "We were manually clicking through the whole app before every deploy. 45 minutes, every time, every sprint. AgentQA does it in 90 seconds and catches things we routinely missed — mobile layout breaks, failed API calls that only show up in a real browser.",
    author: 'CTO',
    role: 'Early-stage startup, 8-person team',
    initials: 'CT',
    detail: 'QA score: 62 → 91 after first scan',
  },
  {
    quote:
      "Delivered a client handoff with a full AgentQA report instead of a Loom walkthrough. Client asked if we had a dedicated QA team. We don't. AgentQA is our QA team.",
    author: 'Founder',
    role: 'Dev agency, client delivery',
    initials: 'DA',
    detail: 'Now runs on every client delivery',
  },
]

export function Testimonials() {
  const [featured, ...rest] = TESTIMONIALS

  return (
    <section className="py-16 px-6 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">From early builders</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Bugs caught before they became user complaints
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto">
            From indie hackers to startup teams — all shipping faster and with more confidence.
          </p>
        </div>

        {/* Featured testimonial */}
        <div className="mb-5 p-6 sm:p-8 rounded-2xl border border-zinc-700/60 bg-zinc-900/60">
          <div className="flex gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-zinc-200 text-base sm:text-lg leading-relaxed mb-6">
            &ldquo;{featured.quote}&rdquo;
          </p>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-blue-400">{featured.initials}</span>
              </div>
              <div>
                <div className="text-white font-semibold">{featured.author}</div>
                <div className="text-zinc-500 text-sm">{featured.role}</div>
              </div>
            </div>
            <span className="text-xs font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
              {featured.detail}
            </span>
          </div>
        </div>

        {/* Secondary testimonials */}
        <div className="grid md:grid-cols-2 gap-5">
          {rest.map((t) => (
            <div
              key={t.initials}
              className="flex flex-col p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
            >
              <p className="text-zinc-300 text-sm leading-relaxed flex-1 mb-5">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="border-t border-zinc-800 pt-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-zinc-400">{t.initials}</span>
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{t.author}</div>
                    <div className="text-zinc-500 text-xs">{t.role}</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 font-mono">{t.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-zinc-700 text-xs mt-6">
          Quotes from early access testers during private beta.
        </p>
      </div>
    </section>
  )
}
