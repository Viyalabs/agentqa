import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required to bundle Playwright in API routes (Node.js runtime only)
  serverExternalPackages: ['playwright'],
  // Skip the duplicate TS type-check pass — we run `tsc --noEmit` separately
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

export default nextConfig
