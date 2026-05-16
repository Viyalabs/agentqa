/**
 * Next.js instrumentation hook — runs once at server startup (nodejs runtime only).
 * Validates required environment variables early so misconfigured deploys fail fast
 * with a clear message rather than surfacing errors deep in request handlers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  type EnvCheck = { key: string; fatal: boolean; hint: string }

  const checks: EnvCheck[] = [
    {
      key:   'NEXT_PUBLIC_SUPABASE_URL',
      fatal: true,
      hint:  'Supabase project URL — find it at supabase.com/dashboard → Settings → API',
    },
    {
      key:   'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      fatal: true,
      hint:  'Supabase anon/public key — same location as above',
    },
    {
      key:   'SUPABASE_SERVICE_ROLE_KEY',
      fatal: true,
      hint:  'Supabase service role key — Settings → API → service_role (keep secret)',
    },
    {
      key:   'WORKER_SECRET',
      fatal: true,
      hint:  'Shared secret between scan/ai worker routes — any long random string',
    },
    {
      key:   'CRON_SECRET',
      fatal: true,
      hint:  'Secret sent by Vercel Cron — must match CRON_SECRET in vercel.json',
    },
    {
      key:   'ANTHROPIC_API_KEY',
      fatal: false,
      hint:  'Anthropic API key — AI analysis will be silently skipped without it',
    },
  ]

  const errors:   string[] = []
  const warnings: string[] = []

  for (const { key, fatal, hint } of checks) {
    if (!process.env[key]) {
      const line = `  ${key} — ${hint}`
      if (fatal) errors.push(line)
      else       warnings.push(line)
    }
  }

  if (warnings.length > 0) {
    console.warn('[startup] Missing optional environment variable(s):')
    for (const w of warnings) console.warn(w)
  }

  if (errors.length > 0) {
    console.error('[startup] FATAL — required environment variable(s) missing:')
    for (const e of errors) console.error(e)
    console.error('[startup] Server will not function correctly until these are set.')
    // Warn loudly but do not throw — throwing here crashes the whole Next.js process,
    // which breaks hot-reload in dev and causes Vercel deployments to fail at startup
    // rather than serving a useful error page. The individual handlers already fail-close.
  }

  // AI service status — always emit so Vercel deployment logs confirm whether
  // AI analysis is active. Masks all but the first 10 and last 4 chars of the key.
  const aiKey = process.env.ANTHROPIC_API_KEY
  if (aiKey) {
    const isValidFormat = aiKey.startsWith('sk-ant-')
    const masked        = `${aiKey.slice(0, 10)}…${aiKey.slice(-4)}`
    if (isValidFormat) {
      console.log(`[startup] AI analysis: ENABLED — key:${masked}`)
    } else {
      console.error(
        `[startup] AI analysis: MISCONFIGURED — key does not start with "sk-ant-" (got ${masked}). ` +
        'Check ANTHROPIC_API_KEY in Vercel environment variables.'
      )
    }
  }
  // If aiKey is absent the warning above already surfaced it.
}
