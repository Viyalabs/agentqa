const TOOLS = [
  { name: 'Cursor', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { name: 'Replit', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { name: 'Lovable', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
  { name: 'v0', color: 'text-zinc-300', bg: 'bg-zinc-800/60 border-zinc-700/60' },
  { name: 'Bolt', color: 'text-zinc-300', bg: 'bg-zinc-800/60 border-zinc-700/60' },
  { name: 'Vercel', color: 'text-zinc-300', bg: 'bg-zinc-800/60 border-zinc-700/60' },
  { name: 'Next.js', color: 'text-zinc-300', bg: 'bg-zinc-800/60 border-zinc-700/60' },
  { name: 'Windsurf', color: 'text-zinc-300', bg: 'bg-zinc-800/60 border-zinc-700/60' },
  { name: 'Any framework', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
]

export function TechBar() {
  return (
    <section className="py-10 border-t border-zinc-800/40 bg-zinc-950/40">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">
          Your AI QA engineer works with every stack
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {TOOLS.map((tool) => (
            <span
              key={tool.name}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium ${tool.color} ${tool.bg}`}
            >
              {tool.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
