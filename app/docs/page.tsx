import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'API Docs — AgentQA CI/CD Integration',
  description:
    'Integrate AgentQA into your CI/CD pipeline. Automatically QA-gate deployments with a single API call.',
}

function Code({ children }: { children: string }) {
  return (
    <code className="bg-zinc-900 border border-zinc-800 text-blue-300 text-sm px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  )
}

function Block({ children }: { children: string }) {
  return (
    <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-sm font-mono text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
      {children}
    </pre>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-20">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {children}
    </section>
  )
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <nav className="sticky top-0 z-40 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            Run a scan →
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 space-y-16">
        {/* Hero */}
        <div>
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Developer docs</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">CI/CD Integration</h1>
          <p className="text-zinc-400 leading-relaxed">
            Run automated QA checks as part of your deployment pipeline. One POST request
            returns a score, issue list, and pass/fail result — so you can block bad
            deploys before your users see them.
          </p>
        </div>

        {/* Authentication */}
        <Section id="auth" title="Authentication">
          <p className="text-base text-zinc-400 leading-relaxed">
            Generate a secret key and set it as <Code>WEBHOOK_API_KEY</Code> in your Vercel
            environment variables. Pass the same value in every request.
          </p>
          <Block>{`# Option A — x-api-key header (recommended)
x-api-key: your_secret_key

# Option B — Authorization header
Authorization: Bearer your_secret_key`}</Block>
        </Section>

        {/* Endpoint */}
        <Section id="endpoint" title="Endpoint">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-lg">
              POST
            </span>
            <code className="text-zinc-200 font-mono text-sm">
              https://qa.viyalabs.com/api/webhook/scan
            </code>
          </div>
        </Section>

        {/* Request */}
        <Section id="request" title="Request body">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                  <th className="pb-3 pr-6 font-medium">Field</th>
                  <th className="pb-3 pr-6 font-medium">Type</th>
                  <th className="pb-3 pr-6 font-medium">Required</th>
                  <th className="pb-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-zinc-900">
                  <td className="py-3 pr-6 font-mono text-blue-300">url</td>
                  <td className="py-3 pr-6 text-zinc-500">string</td>
                  <td className="py-3 pr-6 text-green-400">yes</td>
                  <td className="py-3 text-zinc-400">The URL to scan (must be publicly accessible)</td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-mono text-blue-300">failThreshold</td>
                  <td className="py-3 pr-6 text-zinc-500">number</td>
                  <td className="py-3 pr-6 text-zinc-500">no</td>
                  <td className="py-3 text-zinc-400">Minimum passing score 0–100. Default: <Code>70</Code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* Response */}
        <Section id="response" title="Response">
          <p className="text-base text-zinc-400 leading-relaxed">
            Returns <Code>200</Code> when <Code>score &gt;= failThreshold</Code>, <Code>422</Code> otherwise.
            Your CI runner treats 422 as a build failure.
          </p>
          <Block>{`{
  "passed": true,
  "score": 87,
  "failThreshold": 75,
  "scanId": "3fa85f64-...",
  "url": "https://your-app.vercel.app",
  "reportUrl": "https://qa.viyalabs.com/report/3fa85f64-...",
  "summary": {
    "totalPages": 8,
    "totalIssues": 3,
    "critical": 0,
    "medium": 2,
    "low": 1
  },
  "criticalIssues": []
}`}</Block>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                  <th className="pb-3 pr-6 font-medium">Status</th>
                  <th className="pb-3 font-medium">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {[
                  ['200', 'green-400', 'Scan passed — score ≥ failThreshold'],
                  ['401', 'red-400', 'Invalid or missing API key'],
                  ['422', 'yellow-400', 'Scan failed — score < failThreshold (also used for invalid URL)'],
                  ['429', 'yellow-400', 'Scanner busy — retry in a few minutes'],
                  ['500', 'red-400', 'Internal error'],
                ].map(([code, color, desc]) => (
                  <tr key={code} className="border-b border-zinc-900">
                    <td className={`py-3 pr-6 font-mono text-${color}`}>{code}</td>
                    <td className="py-3 text-zinc-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Examples */}
        <Section id="examples" title="Examples">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">curl</h3>
          <Block>{`curl -f -X POST https://qa.viyalabs.com/api/webhook/scan \\
  -H "x-api-key: $AGENTQA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-app.vercel.app","failThreshold":75}'`}</Block>

          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mt-6">GitHub Actions</h3>
          <Block>{`# .github/workflows/qa.yml
name: QA Gate

on:
  deployment_status:

jobs:
  qa:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Run QA scan
        run: |
          curl -f -X POST https://qa.viyalabs.com/api/webhook/scan \\
            -H "x-api-key: \${{ secrets.AGENTQA_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{"url":"\${{ github.event.deployment_status.target_url }}","failThreshold":75}'`}</Block>

          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mt-6">Vercel + GitHub</h3>
          <Block>{`# Use Vercel's deployment URL from the CLI output
PREVIEW_URL=$(vercel deploy --token $VERCEL_TOKEN)

curl -f -X POST https://qa.viyalabs.com/api/webhook/scan \\
  -H "x-api-key: $AGENTQA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d "{\"url\":\"$PREVIEW_URL\",\"failThreshold\":80}"`}</Block>
        </Section>

        {/* Setup */}
        <Section id="setup" title="Quick setup">
          <ol className="space-y-4 text-base text-zinc-400 list-none">
            {[
              ['1', 'Generate a secret key — e.g. run: openssl rand -hex 32'],
              ['2', 'Add WEBHOOK_API_KEY=<your-key> to your Vercel environment variables'],
              ['3', 'Add AGENTQA_API_KEY as a secret in your GitHub repository (Settings → Secrets)'],
              ['4', 'Paste the GitHub Actions YAML above into .github/workflows/qa.yml'],
              ['5', 'Push — scans will run automatically on every successful deployment'],
            ].map(([n, text]) => (
              <li key={n} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">
                  {n}
                </span>
                <span className="pt-0.5">{text}</span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="border-t border-zinc-800 pt-10 flex items-center justify-between text-sm text-zinc-600">
          <span>Questions? <a href="mailto:support@viyalabs.com" className="text-zinc-400 hover:text-white transition-colors">support@viyalabs.com</a></span>
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            ← Back to AgentQA
          </Link>
        </div>
      </main>
    </div>
  )
}
