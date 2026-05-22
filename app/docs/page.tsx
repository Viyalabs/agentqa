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
          <Link href="/" className="flex items-center gap-2 font-semibold text-white">
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
              https://agentqa.viyalabs.com/api/webhook/scan
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
  "reportUrl": "https://agentqa.viyalabs.com/report/3fa85f64-...",
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
          <Block>{`curl -f -X POST https://agentqa.viyalabs.com/api/webhook/scan \\
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
          curl -f -X POST https://agentqa.viyalabs.com/api/webhook/scan \\
            -H "x-api-key: \${{ secrets.AGENTQA_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{"url":"\${{ github.event.deployment_status.target_url }}","failThreshold":75}'`}</Block>

          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mt-6">Vercel + GitHub</h3>
          <Block>{`# Use Vercel's deployment URL from the CLI output
PREVIEW_URL=$(vercel deploy --token $VERCEL_TOKEN)

curl -f -X POST https://agentqa.viyalabs.com/api/webhook/scan \\
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

        {/* Detection reference */}
        <Section id="detection" title="What we detect">
          <p className="text-base text-zinc-400 leading-relaxed">
            Every scan checks for the following issue types across all discovered pages.
            Issues are classified into three severity levels that feed directly into the QA score.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                  <th className="pb-3 pr-6 font-medium">Type</th>
                  <th className="pb-3 pr-6 font-medium">Severity</th>
                  <th className="pb-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {[
                  ['page_crash', 'critical', 'Page threw an unhandled exception during navigation — users see a blank or broken page'],
                  ['navigation_failure', 'critical', 'Playwright could not reach the page at all — server timeout, DNS failure, or hard crash'],
                  ['js_error', 'critical', 'Uncaught JavaScript exception detected in the browser console with full stack trace'],
                  ['page_not_found', 'medium', 'Page returned HTTP 404 — internal link pointing to a missing route'],
                  ['console_error', 'medium', 'Non-fatal console.error() call — often a failed resource, API error, or React warning'],
                  ['network_failure', 'medium', 'An XHR or fetch request returned a 4xx/5xx status or timed out'],
                  ['missing_image', 'medium', 'An <img> tag failed to load — broken src URL or missing file'],
                  ['missing_alt', 'medium', 'Images without alt text — WCAG 2.1 SC 1.1.1 accessibility violation'],
                  ['mobile_layout', 'medium', 'Content overflows the 375 px mobile viewport — users scroll horizontally'],
                  ['broken_form', 'medium', 'Form submission returned a network error or the form could not be submitted'],
                  ['slow_load', 'low', 'Page took longer than 5 seconds to reach interactive — performance regression risk'],
                  ['large_asset', 'low', 'A script, stylesheet, or image exceeded 500 KB uncompressed'],
                  ['console_warning', 'low', 'console.warn() calls — deprecation notices, missing keys, or React prop warnings'],
                  ['missing_meta', 'low', 'Missing meta description, Open Graph image, H1 heading, or mobile viewport tag'],
                ].map(([type, severity, desc]) => (
                  <tr key={type} className="border-b border-zinc-900">
                    <td className="py-3 pr-6 font-mono text-blue-300 whitespace-nowrap">{type}</td>
                    <td className={`py-3 pr-6 font-mono text-xs whitespace-nowrap ${
                      severity === 'critical' ? 'text-red-400' :
                      severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                    }`}>{severity}</td>
                    <td className="py-3 text-zinc-400 text-xs leading-relaxed">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Score formula */}
        <Section id="score" title="Score formula">
          <p className="text-base text-zinc-400 leading-relaxed">
            The QA score starts at 100 and deducts points by severity. Deductions per severity are
            capped so a single category can't zero out your score alone.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Critical', points: '−20 pts each', cap: 'max −60', color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/5' },
              { label: 'Medium', points: '−8 pts each', cap: 'max −30', color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/5' },
              { label: 'Low', points: '−2 pts each', cap: 'max −10', color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
            ].map((tier) => (
              <div key={tier.label} className={`p-4 rounded-xl border ${tier.border} ${tier.bg}`}>
                <div className={`text-xs font-mono font-bold uppercase tracking-widest mb-2 ${tier.color}`}>
                  {tier.label}
                </div>
                <div className={`text-xl font-bold tabular-nums ${tier.color}`}>{tier.points}</div>
                <div className="text-xs text-zinc-500 mt-1">{tier.cap}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Example: 1 critical + 2 medium + 3 low issues → 100 − 20 − 16 − 6 = <span className="text-white font-semibold">58 / 100</span>.
            The <Code>failThreshold</Code> defaults to 70 in the CI/CD webhook — scores below that return HTTP 422.
          </p>
        </Section>

        <div className="border-t border-zinc-800 pt-10 flex items-center justify-between text-sm text-zinc-600">
          <span>Questions? <a href="mailto:info@viyalabs.com" className="text-zinc-400 hover:text-white transition-colors">info@viyalabs.com</a></span>
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            ← Back to AgentQA
          </Link>
        </div>
      </main>
    </div>
  )
}
