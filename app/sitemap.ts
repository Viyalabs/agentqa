import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentqa.viyalabs.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}`,         lastModified: new Date(), changeFrequency: 'weekly',  priority: 1   },
    { url: `${BASE}/docs`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/scans`,   lastModified: new Date(), changeFrequency: 'daily',   priority: 0.6 },
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]
}
