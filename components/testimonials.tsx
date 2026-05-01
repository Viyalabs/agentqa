const TESTIMONIALS = [
  {
    quote:
      "I shipped a Cursor-built SaaS and AgentQA caught a broken auth redirect and a 404 on my pricing page — 10 minutes before I sent the launch tweet. Would have been embarrassing.",
    author: 'Solo founder',
    role: 'AI SaaS, built with Cursor',
    initials: 'SF',
    detail: '4 pages scanned · 2 critical issues found',
  },
  {
    quote:
      "We were manually clicking through the app before every deploy. 45 minutes, every time. AgentQA does it in under 90 seconds and catches things we routinely missed — mobile layout breaks, failed API calls.",
    author: 'CTO',
    role: 'Early-stage startup',
    initials: 'CT',
    detail: 'Score improved 62 → 91 after first scan',
  },
  {
    quote:
      "Delivered a client handoff with a full QA report instead of a Loom walkthrough. Client asked if we had a QA team. We don't. AgentQA is our QA team.",
    author: 'Founder',
    role: 'Dev agency',
    initials: 'DA',
    detail: 'Runs AgentQA on every client delivery',
  },
]

export function Testimonials() {
  return (
    <section className="py-16 px-4 border-t border-zinc-800/40">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Early builders</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            What teams are saying
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto">
            From indie hackers to startup teams — all catching bugs they would have shipped to users.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.initials}
              className="flex flex-col p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
            >
              {/* Quote */}
              <p className="text-zinc-300 text-sm leading-relaxed flex-1 mb-5">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Footer */}
              <div className="border-t border-zinc-800 pt-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-400">{t.initials}</span>
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
