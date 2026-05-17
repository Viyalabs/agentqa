import { getAdminClient } from '@/lib/supabase'
import type { DetectedFramework, NetworkRequest } from '@/types'

// Each rule maps a URL pattern in network requests to a framework signal + confidence weight
const NETWORK_RULES: Array<{
  framework: string
  pattern: RegExp
  weight: number
  signal: string
}> = [
  // Next.js — highest confidence via its unique /_next/ namespace
  { framework: 'next.js', pattern: /\/_next\/static\//, weight: 0.95, signal: '/_next/static/ in network requests' },
  { framework: 'next.js', pattern: /\/_next\/data\//,   weight: 0.90, signal: '/_next/data/ (ISR/SSG) in network' },
  { framework: 'next.js', pattern: /\/__nextjs/,         weight: 0.85, signal: '__nextjs HMR websocket' },

  // Nuxt (Vue meta-framework)
  { framework: 'nuxt', pattern: /\/_nuxt\//, weight: 0.95, signal: '/_nuxt/ in network requests' },

  // SvelteKit — immutable chunk path is unique
  { framework: 'sveltekit', pattern: /\/_app\/immutable\//, weight: 0.95, signal: '/_app/immutable/ in network' },
  { framework: 'sveltekit', pattern: /\/@sveltejs\//,        weight: 0.90, signal: '/@sveltejs/ package in network' },

  // Astro
  { framework: 'astro', pattern: /\/_astro\//, weight: 0.90, signal: '/_astro/ in network requests' },

  // Remix
  { framework: 'remix', pattern: /\/build\/_shared\/remix/,  weight: 0.90, signal: '/build/_shared/remix in network' },
  { framework: 'remix', pattern: /\/@remix-run\//,           weight: 0.85, signal: '@remix-run package in network' },

  // Gatsby
  { framework: 'gatsby', pattern: /\/page-data\//, weight: 0.90, signal: '/page-data/ (Gatsby) in network' },
  { framework: 'gatsby', pattern: /\/static\/gatsby/, weight: 0.85, signal: '/static/gatsby in network' },

  // Vite (dev or prod build artifacts)
  { framework: 'vite', pattern: /\/@vite\/client/, weight: 0.95, signal: '/@vite/client HMR client' },
  { framework: 'vite', pattern: /\/@fs\//,         weight: 0.80, signal: '/@fs/ Vite file-system path' },

  // React (CDN or named bundle — lower weight, often co-occurs with Next/Gatsby/Remix)
  { framework: 'react', pattern: /react\.production\.min\.js/, weight: 0.85, signal: 'react.production.min.js' },
  { framework: 'react', pattern: /react\.development\.js/,    weight: 0.85, signal: 'react.development.js' },
  { framework: 'react', pattern: /\/react@\d/,                weight: 0.80, signal: 'react@version CDN path' },

  // Vue (CDN)
  { framework: 'vue', pattern: /vue\.global\.prod\.js/, weight: 0.90, signal: 'vue.global.prod.js CDN' },
  { framework: 'vue', pattern: /vue\.min\.js/,          weight: 0.85, signal: 'vue.min.js CDN' },
  { framework: 'vue', pattern: /\/vue@\d/,              weight: 0.80, signal: 'vue@version CDN path' },

  // Angular — zone.js is Angular-specific; main.hash.js is its typical bundle name
  { framework: 'angular', pattern: /zone\.js/,                   weight: 0.75, signal: 'zone.js (Angular runtime)' },
  { framework: 'angular', pattern: /\/main\.[a-f0-9]{8,}\.js$/,  weight: 0.55, signal: 'main.[hash].js (Angular bundle)' },

  // WordPress
  { framework: 'wordpress', pattern: /\/wp-content\//, weight: 0.95, signal: '/wp-content/ in network' },
  { framework: 'wordpress', pattern: /\/wp-includes\//, weight: 0.90, signal: '/wp-includes/ in network' },
  { framework: 'wordpress', pattern: /\/wp-json\//,     weight: 0.90, signal: '/wp-json/ REST API call' },

  // Laravel (Inertia/Vite)
  { framework: 'laravel', pattern: /\/vendor\/laravel\//, weight: 0.90, signal: '/vendor/laravel/ in network' },

  // Ruby on Rails
  { framework: 'rails', pattern: /\/packs\/js\//,    weight: 0.85, signal: '/packs/js/ (Webpacker)' },
  { framework: 'rails', pattern: /\/assets\/application/, weight: 0.80, signal: '/assets/application (Sprockets)' },

  // Shopify
  { framework: 'shopify', pattern: /cdn\.shopify\.com/,     weight: 0.95, signal: 'cdn.shopify.com CDN' },
  { framework: 'shopify', pattern: /cdn\.shopifycloud\.com/, weight: 0.90, signal: 'Shopify cloud CDN' },
  { framework: 'shopify', pattern: /monorail-edge\.shopifysvc\.com/, weight: 0.95, signal: 'Shopify analytics beacon' },
  { framework: 'shopify', pattern: /\/cart\.js$/,            weight: 0.85, signal: 'Shopify cart.js endpoint' },

  // Vercel
  { framework: 'vercel', pattern: /\/_vercel\/insights/, weight: 0.90, signal: 'Vercel Analytics script' },
  { framework: 'vercel', pattern: /va\.vercel-scripts\.com/, weight: 0.90, signal: 'Vercel Web Analytics' },

  // Tailwind (CDN usage only — JIT builds are indistinguishable from other CSS)
  { framework: 'tailwind', pattern: /cdn\.tailwindcss\.com/, weight: 0.90, signal: 'Tailwind CSS CDN' },

  // Alpine.js (Tailwind's common companion)
  { framework: 'alpine', pattern: /\/alpinejs@\d/,      weight: 0.85, signal: 'Alpine.js CDN version path' },
  { framework: 'alpine', pattern: /cdn\.jsdelivr\.net\/npm\/alpinejs/, weight: 0.85, signal: 'Alpine.js via jsDelivr' },
]

// When a meta-framework is detected, imply its underlying library at lower confidence
const IMPLIED_BY: Record<string, Array<{ framework: string; weight: number }>> = {
  'next.js':    [{ framework: 'react',  weight: 0.90 }],
  'gatsby':     [{ framework: 'react',  weight: 0.90 }],
  'remix':      [{ framework: 'react',  weight: 0.90 }],
  'nuxt':       [{ framework: 'vue',    weight: 0.90 }],
  'sveltekit':  [{ framework: 'svelte', weight: 0.90 }],
}

/**
 * Analyse collected network requests and return detected frameworks with
 * confidence scores and the signals that triggered detection.
 */
export function detectFrameworks(networkRequests: NetworkRequest[]): DetectedFramework[] {
  // framework → { maxWeight, signals[] }
  const scores = new Map<string, { maxWeight: number; signals: string[] }>()

  for (const req of networkRequests) {
    for (const rule of NETWORK_RULES) {
      if (rule.pattern.test(req.url)) {
        const entry = scores.get(rule.framework) ?? { maxWeight: 0, signals: [] }
        if (!entry.signals.includes(rule.signal)) {
          entry.signals.push(rule.signal)
          entry.maxWeight = Math.max(entry.maxWeight, rule.weight)
        }
        scores.set(rule.framework, entry)
      }
    }
  }

  // Add implied libraries (only if not already detected with higher confidence)
  for (const [meta, implies] of Object.entries(IMPLIED_BY)) {
    if (scores.has(meta)) {
      for (const { framework: implied, weight } of implies) {
        if (!scores.has(implied)) {
          scores.set(implied, {
            maxWeight: weight,
            signals: [`implied by ${meta}`],
          })
        }
      }
    }
  }

  return [...scores.entries()]
    .map(([framework, { maxWeight, signals }]) => ({ framework, confidence: maxWeight, signals }))
    .filter((f) => f.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence)
}

/**
 * Read all network_details from scanned_pages for a scan, run detection,
 * persist results to scan_frameworks, and return detected framework names.
 */
export async function detectAndStoreFrameworks(scanId: string): Promise<string[]> {
  const db = getAdminClient()

  const { data: pages } = await db
    .from('scanned_pages')
    .select('network_details')
    .eq('scan_id', scanId)

  if (!pages || pages.length === 0) return []

  // Aggregate all network requests across all pages
  const allRequests: NetworkRequest[] = pages.flatMap(
    (p) => (p.network_details as NetworkRequest[] | null) ?? []
  )

  if (allRequests.length === 0) return []

  const detected = detectFrameworks(allRequests)
  if (detected.length === 0) return []

  // Persist to scan_frameworks (ignore errors — non-critical)
  await db
    .from('scan_frameworks')
    .insert(
      detected.map((f) => ({
        scan_id: scanId,
        framework: f.framework,
        confidence: f.confidence,
        signals: f.signals,
      }))
    )
    .then(({ error }) => {
      if (error) console.error('[framework-detector] Failed to store frameworks:', error.message)
    })

  console.log(
    `[framework-detector] ${scanId}: detected ${detected.map((f) => `${f.framework}(${(f.confidence * 100).toFixed(0)}%)`).join(', ')}`
  )

  return detected.map((f) => f.framework)
}
