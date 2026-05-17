const TESTIMONIALS = [
  {
    quote:
      "Handed off a project with an AgentQA report attached. Client asked if we had a dedicated QA team. We don't.",
    author: 'Sophie M.',
    role: 'Founder, dev studio',
    initials: 'SM',
    detail: 'Runs on every client delivery',
    featured: true,
  },
  {
    quote:
      "30 minutes before my launch email. AgentQA found a broken auth redirect — new users would have hit a blank screen. Caught it. Fixed it. Sent the email.",
    author: 'Marcus Chen',
    role: 'Solo founder, B2B SaaS · built with Cursor',
    initials: 'MC',
    detail: '2 critical bugs caught pre-launch',
  },
  {
    quote:
      "We used to click through the whole app before every deploy. 45 minutes, every sprint. AgentQA does it in 90 seconds — and catches mobile layout breaks we kept missing.",
    author: 'Rafal K.',
    role: 'CTO, early-stage startup · 8-person team',
    initials: 'RK',
    detail: 'QA score: 62 → 91 after first scan',
  },
]

export function Testimonials() {
  const [featured, ...rest] = TESTIMONIALS

  return (
    <section className="py-20 border-t border-zinc-800/40">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Real results · Live teams</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Teams that replaced manual QA with AgentQA
          </h2>
        </div>

        {/* Featured testimonial */}
        <div className="mb-6 p-6 sm:p-8 rounded-2xl border border-zinc-700/60 bg-zinc-900/60">
          <div className="flex gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-base text-zinc-200 leading-relaxed mb-6">
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
        <div className="grid md:grid-cols-2 gap-6">
          {rest.map((t) => (
            <div
              key={t.initials}
              className="flex flex-col p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-200"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-base text-zinc-400 leading-relaxed flex-1 mb-5">
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
                <p className="text-xs text-zinc-500 font-mono">{t.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-zinc-500 text-xs mt-6">
          Early access users — more stories coming as we grow.
        </p>
      </div>
    </section>
  )
}
