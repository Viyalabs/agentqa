import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep playwright and @sparticuz/chromium as external — they have native binaries
  // that must be loaded from node_modules, not bundled by webpack/turbopack.
  serverExternalPackages: ['playwright', '@sparticuz/chromium'],

  // Tell Next.js file-tracing to include the @sparticuz/chromium binary files
  // in the Vercel deployment bundle. Without this, the /bin directory is excluded
  // and the browser fails to launch with "input directory does not exist".
  outputFileTracingIncludes: {
    '/api/scan': ['./node_modules/@sparticuz/chromium/**/*'],
    '/api/scan/worker': ['./node_modules/@sparticuz/chromium/**/*'],
  },

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
