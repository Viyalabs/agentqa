import { getAdminClient } from '@/lib/supabase'
import { updatePatternTemplates } from './pattern-matcher'
import { callClaude, isClaudeConfigured, CLAUDE_HAIKU, logClaudeError, extractJSON } from '@/services/ai/claude'
import { AI_BATCH_SIZE, AI_BATCH_CONCURRENCY } from '@/services/ai-config'
import type { IssueType, IssueSeverity, PatternMatchResult } from '@/types'

const ANALYSIS_SYSTEM_PROMPT =
  'You are a senior QA engineer and debugging specialist analyzing automated browser scan findings. ' +
  'You receive raw evidence — console errors, network failures, stack traces, timing data. ' +
  'Translate that evidence into precise, developer-ready diagnoses. ' +
  'Use hedged language when evidence is partial: "likely caused by", "commonly occurs when", "this typically indicates". ' +
  'Reserve definitive statements for cases where data clearly identifies the cause (specific error text, status code, stack frame). ' +
  'Cite the actual error messages, status codes, and API names from the evidence. ' +
  'Never invent function names, file paths, error codes, or status codes absent from the provided data.'

interface IssueForAnalysis {
  id: string
  type: IssueType
  severity: IssueSeverity
  title: string
  description: string | null
  details: Record<string, unknown> | null
  fingerprint: string | null
  occurrenceCount?: number  // from pattern DB — how many times seen across all scans
}

interface AIAnalysis {
  summary: string
  rootCause: string
  fixSuggestion: string
  confidence: string   // "low" | "medium" | "high" — from Claude's self-assessment
}

// ── Logging helpers ────────────────────────────────────────────────────────────

/** Returns a function that, when called, gives elapsed milliseconds since perf() was called. */
function perf(): () => number {
  const t0 = Date.now()
  return () => Date.now() - t0
}

/** Write a structured trace line for the AI pipeline. Prefix is grep-friendly. */
function pipelineLog(scanId: string, phase: string, msg: string): void {
  console.log(`[ai-pipeline:${scanId}] [${phase}] ${msg}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceToFloat(c: string): number | null {
  switch (c) {
    case 'high':   return 0.9
    case 'medium': return 0.6
    case 'low':    return 0.3
    default:       return null
  }
}

function buildAnalysisData(issue: IssueForAnalysis, category: IssueCategory): Record<string, unknown> {
  const tags = [...new Set([issue.type, category.toLowerCase().replace('_', '-'), issue.severity])]
  const errorClass = typeof issue.details?.errorType === 'string'
    ? issue.details.errorType
    : typeof issue.details?.type === 'string'
      ? issue.details.type
      : null
  return {
    tags,
    category,
    ...(errorClass ? { error_class: errorClass } : {}),
  }
}

/**
 * Extract only the semantically useful fields from issue.details per type.
 * Avoids sending large JSON blobs (full network request arrays, long stacks)
 * when Claude only needs a focused excerpt.
 *
 * @param limit Maximum output length in characters (batch vs solo differ).
 */
function extractDetails(issue: IssueForAnalysis, limit = 200): string {
  const d = issue.details
  if (!d) return 'none'
  switch (issue.type) {
    case 'js_error': {
      const errors = (d.errors as string[] | undefined) ?? []
      const stacks = (d.stacks as string[] | undefined) ?? []
      const parts = errors.slice(0, 2).map((msg, i) => {
        const frames = (stacks[i] ?? '').split('\n')
          .slice(1, 4)
          .map(l => l.trim().slice(0, 80))
          .filter(Boolean)
        const frameStr = frames.length ? ` at: ${frames.join(' → ')}` : ''
        return `${msg.slice(0, 150)}${frameStr}`
      })
      return parts.join(' | ').slice(0, limit) || 'none'
    }
    case 'console_error':
    case 'console_warning': {
      const errors = (d.errors as string[] | undefined) ?? []
      return errors.slice(0, 3).map(e => e.slice(0, 90)).join(' | ').slice(0, limit) || 'none'
    }
    case 'network_failure': {
      const raw = (d.failures as Array<{ url?: string; method?: string; error?: string } | string> | undefined) ?? []
      return raw.slice(0, 3).map(f => {
        if (typeof f === 'string') return String(f).slice(0, 80)
        const method = f.method ?? 'GET'
        const url    = String(f.url ?? '').slice(0, 70)
        const err    = f.error ? ` (${String(f.error).slice(0, 50)})` : ''
        return `${method} ${url}${err}`
      }).join(' | ').slice(0, limit) || 'none'
    }
    case 'slow_load': {
      const ms  = (d.loadTimeMs as number | undefined) ?? '?'
      const url = d.url ? ` url:${String(d.url).slice(0, 80)}` : ''
      return `loadTime:${ms}ms${url}`
    }
    case 'large_asset': {
      const assets = (d.assets as Array<{ url: string; sizeKb: number }> | undefined) ?? []
      const total  = assets.reduce((s, a) => s + a.sizeKb, 0)
      const top    = assets.slice(0, 2).map(a => `${String(a.url).slice(-40)}(${a.sizeKb}KB)`).join(', ')
      return `total:${total}KB top:[${top}]`.slice(0, limit)
    }
    case 'page_not_found':
    case 'page_crash':
    case 'navigation_failure':
    case 'broken_form':
    case 'mobile_layout':
      return d.url ? `url:${String(d.url).slice(0, 90)}` : 'none'
    case 'missing_image': {
      const images = (d.images as string[] | undefined) ?? []
      return images.slice(0, 3).map(u => String(u).slice(0, 60)).join(' | ').slice(0, limit) || 'none'
    }
    case 'missing_alt':
      return `count:${(d.count as number | undefined) ?? '?'} url:${String(d.url ?? '').slice(0, 80)}`
    case 'missing_meta':
      return d.count
        ? `count:${d.count} url:${String(d.url ?? '').slice(0, 80)}`
        : `url:${String(d.url ?? '').slice(0, 80)}`
    default:
      return JSON.stringify(d).slice(0, limit)
  }
}

type IssueCategory = 'JS_ERROR' | 'NETWORK' | 'MOBILE' | 'PERFORMANCE' | 'UI' | 'ACCESSIBILITY' | 'SEO' | 'OTHER'

function frameworkLabel(frameworks: string[]): string {
  if (frameworks.length === 0) return 'unknown stack'
  return frameworks.slice(0, 2).join(' + ')
}

// Per-framework diagnostic hints — injected into prompts when the framework is detected.
// These tell Claude what failure patterns are common for each stack so it avoids generic advice.
const FRAMEWORK_HINTS: Record<string, string> = {
  'next.js':   'Next.js: hydration errors (SSR/CSR state diff, window/document outside browser guard, Date.now() in render); next/image needs width+height or fill + domain in next.config.js remotePatterns; App Router needs "use client" for interactive components; async Server Components need Suspense.',
  'react':     'React: missing key props on lists, null/undefined access before first render, setState after unmount (add cleanup), unhandled Promise rejections in useEffect, prop-type mismatches in console.',
  'wordpress': 'WordPress: JS errors commonly from plugin conflicts (jQuery version mismatch, duplicate script handles); /wp-json/ 401/403 = REST API auth required; /wp-content/ 404s = CDN cache or permalink flush needed; Autoptimize/W3TC/WP Rocket can minify scripts causing conflicts.',
  'shopify':   'Shopify: JS errors often from theme.js + app script conflicts; images should use CDN sizing params (?width=N); storefront API 429 = rate limits; Dawn theme compatibility issues with older apps; cart.js failures block checkout.',
  'vue':       'Vue: reactivity issues with non-reactive properties (use reactive()/ref()); missing .value in template for refs; Nuxt hydration mismatches from asyncData timing or window access in server context.',
  'nuxt':      'Nuxt: hydration mismatches from asyncData vs useFetch differences; SSR-only APIs used in universal context; use <ClientOnly> for browser-only components; check if error is in server or client build.',
  'angular':   'Angular: NgZone exceptions from async ops outside zone; ExpressionChangedAfterItHasBeenCheckedError from change detection timing; missing providers in module declarations; zone.js errors in console.',
  'laravel':   'Laravel: 419 = CSRF token mismatch (add X-CSRF-TOKEN header to AJAX calls); /api/ 401 = Sanctum auth not configured or token expired; mix-manifest.json 404 if npm run prod was not run; Livewire component sync errors.',
  'sveltekit': 'SvelteKit: hydration mismatches from +page.server.js vs +page.js data loading differences; onMount is client-only; browser APIs in server-side load functions cause SSR errors.',
  'astro':     'Astro: JS errors in island components (check client:load vs client:visible directive); hydration order issues with multiple islands; build-time vs runtime data fetching conflicts.',
  'remix':     'Remix: loader/action 401/403 = auth middleware not applied to this route; nested route data missing; progressive enhancement breaks when JS error occurs in root loader.',
  'vite':      'Vite: dev/prod build differences common; dynamic import() paths must be statically analyzable; @fs/ paths only exist in dev mode; CSS modules scope differs from plain CSS.',
  'cloudflare': 'Cloudflare: CF ray IDs in responses indicate CDN-level blocking; 521/522 = origin unreachable; Rocket Loader conflicts with inline scripts (add data-cfasync="false"); Workers KV has eventual consistency.',
  'vercel':    'Vercel: function timeouts (10s hobby, 60s pro); Edge runtime for streaming responses, Node.js runtime for heavy compute; cold starts affect first-request latency; check build logs for function size limits.',
  'rails':     'Rails: Turbo/Stimulus conflicts with custom JS; asset pipeline fingerprint mismatches after deploy; CSRF authenticity token missing in AJAX calls (use rails-ujs or add X-CSRF-Token header).',
  'gatsby':    'Gatsby: build-time vs runtime data differences; window/document access causes SSR build failures (wrap in typeof window !== "undefined"); GraphQL query changes require gatsby develop restart.',
}

function frameworkGuidance(frameworks: string[]): string {
  const active = frameworks
    .map(f => FRAMEWORK_HINTS[f.toLowerCase()])
    .filter(Boolean)
  return active.length > 0
    ? `\nFramework context (apply to relevant issues):\n${active.map(h => `  ${h}`).join('\n')}`
    : ''
}

function issueCategory(type: IssueType): IssueCategory {
  switch (type) {
    case 'js_error':
    case 'console_error':
    case 'console_warning':
    case 'page_crash':
      return 'JS_ERROR'
    case 'network_failure':
    case 'navigation_failure':
      return 'NETWORK'
    case 'mobile_layout':
      return 'MOBILE'
    case 'slow_load':
    case 'large_asset':
      return 'PERFORMANCE'
    case 'missing_image':
    case 'broken_form':
    case 'page_not_found':
      return 'UI'
    case 'missing_alt':
      return 'ACCESSIBILITY'
    case 'missing_meta':
      return 'SEO'
    default:
      return 'OTHER'
  }
}

function issueTypeGuidance(category: IssueCategory): string {
  switch (category) {
    case 'JS_ERROR':
      return 'Stack trace origin, missing null/undefined checks, unhandled promise rejections, third-party script conflicts. Distinguish app code from vendor bundle errors.'
    case 'NETWORK':
      return 'HTTP 401/403 = auth/permissions (check session token, CORS preflight, missing header). HTTP 0 or ECONNREFUSED = server unreachable or DNS failure. Timeout = latency or gateway. Check the error field in data — it is the browser error text, not a status code.'
    case 'MOBILE':
      return 'Viewport meta tag presence, touch target size (min 44×44px), CSS media query breakpoints, horizontal overflow, iOS/Android rendering differences, font scaling.'
    case 'PERFORMANCE':
      return 'Core Web Vitals (LCP/FID/CLS), render-blocking resources, bundle splitting opportunities, Cache-Control/ETag headers, image format and size, lazy loading.'
    case 'UI':
      return 'Broken asset URL (check path casing and CDN origin), CSS z-index/overflow, layout overflow on small viewports, missing resource 404, form validation and submission flow.'
    case 'ACCESSIBILITY':
      return 'WCAG 2.1 compliance — missing alt attributes prevent screen reader users from understanding images. Add descriptive alt text; use alt="" for decorative images. Check image rendering pipeline (CMS, component library defaults).'
    case 'SEO':
      return 'Missing meta tags reduce search ranking and social sharing click-through. For meta description: add a unique 150-160 char description per page. For og:image: add a 1200×630 image. For H1: each page needs exactly one H1 matching the primary keyword.'
    default:
      return 'Specific symptom observed, most likely root cause given the detected stack, concrete actionable fix steps.'
  }
}

function issueCategoryHint(category: IssueCategory): string {
  switch (category) {
    case 'JS_ERROR':      return 'stack origin, missing null-checks, polyfill gaps, app vs third-party code'
    case 'NETWORK':       return '401/403=auth/permissions, 0=server unreachable, CORS, DNS; check error field'
    case 'MOBILE':        return 'viewport meta tag, horizontal overflow at 375px, touch target size (44px min)'
    case 'PERFORMANCE':   return 'render-blocking scripts/CSS, uncompressed images, missing lazy loading, Cache-Control'
    case 'UI':            return 'broken asset URL path/casing, CDN origin, CSS overflow, 404 on nested route'
    case 'ACCESSIBILITY': return 'descriptive alt text required; alt="" for decorative; check CMS/component defaults'
    case 'SEO':           return 'unique 150-160 char meta description; og:image 1200×630; exactly one H1 per page'
    default:              return 'specific symptom observed, most likely root cause, concrete ordered fix steps'
  }
}

/**
 * Build a batch prompt covering up to BATCH_SIZE issues with anti-hallucination constraints.
 * Shared context is written once — major token saving vs N individual prompts.
 */
function buildBatchPrompt(
  appUrl: string,
  issues: IssueForAnalysis[],
  frameworks: string[],
): string {
  const stack = frameworkLabel(frameworks)

  // Category hints — only for categories present in this batch
  const seenCategories = [...new Set(issues.map(i => issueCategory(i.type)))]
  const hintLines = seenCategories
    .map(cat => `  ${cat}: ${issueCategoryHint(cat)}`)
    .join('\n')

  const fwContext = frameworkGuidance(frameworks)

  const issueLines = issues.map((issue, i) => {
    const cat = issueCategory(issue.type)
    const patternLine = issue.occurrenceCount && issue.occurrenceCount > 2
      ? `\n    pattern: seen ${issue.occurrenceCount}× across scans — recurring`
      : ''
    return [
      `[${i + 1}] ${cat} | ${issue.type} | ${issue.severity}`,
      `    title: ${issue.title}`,
      `    desc:  ${issue.description ?? 'none'}`,
      `    data:  ${extractDetails(issue, 240)}`,
    ].join('\n') + patternLine
  }).join('\n\n')

  return `App: ${appUrl}
Stack: ${stack}${fwContext}

Category hints (apply to matching issues):
${hintLines}

CONSTRAINTS:
- Use hedged language when evidence is partial: "likely caused by", "commonly occurs when", "this typically indicates".
- State causes definitively ONLY when data clearly identifies them (specific error text, status code, or stack frame present).
- root_cause: cite specific evidence from the data — error message, status code, API name. 1-2 sentences. No generic statements.
- Never invent error codes, file paths, function names, or status codes absent from the data.
- confidence "high" = data clearly identifies cause; "medium" = partial evidence; "low" = data is sparse or ambiguous.
- summary: 1 tight sentence — what the user experiences (include the specific feature/page if the URL is in data).
- fix: 2-4 concrete ordered steps using ${stack} idioms and APIs where applicable.

Issues:
${issueLines}

Return a JSON array with exactly ${issues.length} objects in the same order:
[{"i":1,"summary":"...","root_cause":"...","fix":["step 1","step 2"],"confidence":"high"},...]

IMPORTANT: Return ONLY the raw JSON array. Start with [ and end with ]. No markdown, no backticks, no explanation.`
}

/**
 * Analyze a batch of representative issues in a single Claude call.
 * Returns a map of cacheKey → AIAnalysis for each issue that was successfully analyzed.
 * Throws on API failure so the caller can fall back to individual calls.
 */
async function analyzeBatch(
  appUrl: string,
  issues: IssueForAnalysis[],
  frameworks: string[],
  batchLabel: string,
): Promise<{ results: Map<string, AIAnalysis>; tokensIn: number; tokensOut: number }> {
  const claudeResult = await callClaude({
    prompt:    buildBatchPrompt(appUrl, issues, frameworks),
    system:    ANALYSIS_SYSTEM_PROMPT,
    model:     CLAUDE_HAIKU,
    maxTokens: Math.max(200 * issues.length, 600),
    timeoutMs: 60_000,
    label:     batchLabel,
  })
  if (!claudeResult.ok) {
    logClaudeError(batchLabel, claudeResult.error)
    throw new Error(claudeResult.error.message)
  }
  const text = claudeResult.data
  const tokensIn  = claudeResult.usage.inputTokens
  const tokensOut = claudeResult.usage.outputTokens
  const parsed = extractJSON(text) as Array<{
    i: number
    summary?: string
    root_cause?: string
    fix?: string | string[]
    confidence?: string
  }>

  if (!Array.isArray(parsed)) throw new TypeError('Batch response was not a JSON array')

  const result = new Map<string, AIAnalysis>()
  for (const item of parsed) {
    const rep = issues[item.i - 1]
    if (!rep) continue
    const summary    = item.summary?.trim()    ?? ''
    const rootCause  = item.root_cause?.trim() ?? ''
    const fixRaw     = item.fix
    const fixSuggestion = Array.isArray(fixRaw)
      ? fixRaw.map((s, idx) => `${idx + 1}. ${s}`).join('\n')
      : (fixRaw?.trim() ?? '')
    if (summary) {
      result.set(rep.fingerprint ?? rep.type, {
        summary,
        rootCause,
        fixSuggestion,
        confidence: item.confidence ?? 'low',
      })
    }
  }
  return { results: result, tokensIn, tokensOut }
}

/** Single-issue fallback prompt with JSON output and type-specific analysis guidance */
function buildSoloPrompt(appUrl: string, issue: IssueForAnalysis, frameworks: string[]): string {
  const detailText = extractDetails(issue, 400)
  const category = issueCategory(issue.type)
  const guidance = issueTypeGuidance(category)
  const stack = frameworkLabel(frameworks)
  const fwContext = frameworkGuidance(frameworks)
  const patternCtx = issue.occurrenceCount && issue.occurrenceCount > 2
    ? `\nPattern: seen ${issue.occurrenceCount}× across scans — this is a recurring issue type.`
    : ''

  return `You are a senior QA engineer diagnosing a web application failure.

App: ${appUrl}
Stack: ${stack}${fwContext}
Category: ${category}
Issue type: ${issue.type}
Severity: ${issue.severity}
Title: ${issue.title}
Description: ${issue.description ?? 'none'}
Technical data: ${detailText}${patternCtx}

FOCUS: ${guidance}

CONSTRAINTS:
- Use hedged language when evidence is partial: "likely caused by", "commonly occurs when", "this typically indicates".
- State causes definitively ONLY when data clearly shows it (specific error text, status code, or stack frame present).
- root_cause: name a specific technical reason using evidence from the data. No generic statements. Never invent.
- fix: use ${stack} idioms and APIs where applicable. Steps must be immediately actionable.
- summary: what the user experiences — include the specific page or feature if URL appears in the data.
- confidence: "low" if data is sparse; "medium" if partial evidence; "high" if cause is clearly in the data.

Respond with only a JSON object. No markdown, no extra text.
{"summary":"...","root_cause":"...","fix":["step 1","step 2"],"confidence":"high"}`
}

function parseSoloResponse(text: string): AIAnalysis {
  const parsed = extractJSON(text) as {
    summary?: string
    root_cause?: string
    fix?: string | string[]
    confidence?: string
  }
  const fixRaw = parsed.fix
  const fixSuggestion = Array.isArray(fixRaw)
    ? fixRaw.map((s, idx) => `${idx + 1}. ${s}`).join('\n')
    : (fixRaw?.trim() ?? '')
  return {
    summary:      parsed.summary?.trim()    ?? '',
    rootCause:    parsed.root_cause?.trim() ?? '',
    fixSuggestion,
    confidence:   parsed.confidence         ?? 'low',
  }
}

interface IssueOverviewItem {
  type: string
  severity: string
  title: string
}

interface RegressionData {
  newCount: number
  resolvedCount: number
  previousScore: number | null
}

function buildOverviewPrompt(
  appUrl: string,
  score: number,
  issues: IssueOverviewItem[],
  frameworks: string[],
  regression: RegressionData,
): string {
  const stackLine = frameworks.length > 0 ? `Stack: ${frameworkLabel(frameworks)}\n` : ''
  const health = score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor'
  const criticals = issues.filter(i => i.severity === 'critical').length
  const mediums   = issues.filter(i => i.severity === 'medium').length
  const lows      = issues.filter(i => i.severity === 'low').length

  const issueLines = issues.map((issue, idx) =>
    `  ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.type} — "${issue.title}"`
  ).join('\n')

  const regressionLine = regression.newCount > 0 || regression.resolvedCount > 0
    ? `Regression vs last scan: ${regression.newCount} new issue${regression.newCount !== 1 ? 's' : ''}, ${regression.resolvedCount} resolved`
    : regression.previousScore !== null
    ? `vs last scan: score was ${regression.previousScore}/100 (${score >= regression.previousScore ? '+' : ''}${score - regression.previousScore} pts)`
    : 'First scan for this URL'

  return `You are a senior QA engineer diagnosing a web application. Reason across ALL findings — identify what is related, what is a symptom vs root cause, and what to fix first.

App: ${appUrl}
${stackLine}Score: ${score}/100 (${health}) — ${criticals} critical, ${mediums} medium, ${lows} low
${regressionLine}

All findings:
${issueLines}

Write 2-4 sentences of plain prose:
1. If multiple issues share a root cause, state that connection explicitly ("Issues 2 and 5 are both caused by…"). If they are independent, say so.
2. The single highest-leverage fix — what one change eliminates the most symptoms.
3. If there are new or resolved issues vs the last scan, mention it concisely.

CONSTRAINTS: No bullet points. No filler ("it seems", "looks like"). Name specific issue numbers and types. Speak directly to the developer acting on this today.`
}

/** Append a message to scan_logs so it surfaces in the user-facing report. */
async function logToScan(db: ReturnType<typeof getAdminClient>, scanId: string, message: string): Promise<void> {
  try {
    await db.from('scan_logs').insert({ scan_id: scanId, message })
  } catch { /* non-fatal */ }
}

/**
 * Analyze all issues for a completed scan.
 *
 * Deduplication strategy (moat layer):
 * - Group issues by fingerprint (precise) rather than just type (coarse).
 * - If the pattern DB already has a root_cause_template for a fingerprint,
 *   reuse it — skip the Claude call entirely. This compounds over time:
 *   common bugs get free analysis after the first scan that saw them.
 * - After a fresh Claude analysis, write the result back to the pattern
 *   as a reusable template for all future scans.
 *
 * @param patternMatches  Output from matchScanIssues() — issue ID → pattern data.
 *                        Pass empty Map if pattern matching was skipped.
 * @param frameworks      Detected framework names for this scan (context for Claude).
 */
export async function analyzeIssues(
  scanId: string,
  appUrl: string,
  patternMatches: Map<string, PatternMatchResult> = new Map(),
  frameworks: string[] = [],
  severities: string[] = ['critical', 'medium'],
): Promise<void> {
  const db    = getAdminClient()
  const total = perf()

  pipelineLog(scanId, 'analyzeIssues', `START — severities:[${severities.join(',')}] patternMatches:${patternMatches.size}`)

  if (!isClaudeConfigured()) {
    console.warn('[ai-analyzer] ANTHROPIC_API_KEY not set — skipping issue analysis')
    await logToScan(db, scanId, 'AI analysis skipped — ANTHROPIC_API_KEY not configured.')
    return
  }

  // Two parallel queries: issues needing analysis + total eligible count.
  // The count lets us log how many were skipped (ai_summary already set).
  const [
    { data: issues, error },
    { count: eligibleTotal },
  ] = await Promise.all([
    db.from('issues_with_analysis')
      .select('id, type, severity, title, description, details, fingerprint')
      .eq('scan_id', scanId)
      .in('severity', severities)
      .is('ai_summary', null),
    db.from('issues_with_analysis')
      .select('*', { count: 'exact', head: true })
      .eq('scan_id', scanId)
      .in('severity', severities),
  ])

  if (error) {
    // Log the real error — this is the most likely cause of "AI sometimes skipped"
    console.error(`[ai-analyzer] ${scanId}: issues_with_analysis query failed — ${error.message}`)
    await logToScan(db, scanId, `AI analysis skipped — DB query error: ${error.message}`)
    return
  }

  const alreadyAnalyzed = (eligibleTotal ?? 0) - (issues?.length ?? 0)

  if (!issues || issues.length === 0) {
    pipelineLog(
      scanId, 'analyzeIssues',
      `SKIP — all ${eligibleTotal ?? 0} eligible issue(s) already analyzed (ai_summary set, no work needed)`
    )
    return
  }

  pipelineLog(
    scanId, 'analyzeIssues',
    `${issues.length} of ${eligibleTotal ?? '?'} issue(s) need analysis` +
    (alreadyAnalyzed > 0 ? ` — ${alreadyAnalyzed} already analyzed (skipped)` : '') +
    ' — starting pipeline'
  )
  await logToScan(db, scanId, `AI analysis starting for ${issues.length} issue(s)…`)

  // --- Step 1: apply cached templates from pattern DB (free, instant) ----------
  const needsAnalysis: IssueForAnalysis[] = []
  let cacheHits = 0

  await Promise.allSettled(
    (issues as IssueForAnalysis[]).map(async (issue) => {
      const match = patternMatches.get(issue.id)
      if (match?.rootCauseTemplate && match?.fixTemplate && !match.needsRefresh) {
        cacheHits++
        pipelineLog(scanId, 'pattern-cache', `HIT  issue:${issue.id} type:${issue.type} fp:${issue.fingerprint ?? 'none'}`)
        // Pattern already has a solution — write to issues_enriched only
        await db.from('issues_enriched').upsert({
          issue_id:         issue.id,
          summary:          issue.description?.slice(0, 200) ?? issue.title,
          root_cause:       match.rootCauseTemplate,
          fix_suggestion:   match.fixTemplate,
          analysis_data:    { tags: [issue.type, issue.severity], category: issueCategory(issue.type) },
          model_version:    CLAUDE_HAIKU,
          from_pattern:     true,
          pattern_id:       match.patternId,
          analyzed_at:      new Date().toISOString(),
        }, { onConflict: 'issue_id' })
      } else {
        const reason = !match ? 'no-pattern' : match.needsRefresh ? 'needs-refresh' : 'no-template'
        pipelineLog(scanId, 'pattern-cache', `MISS issue:${issue.id} type:${issue.type} reason:${reason}`)
        needsAnalysis.push({
          ...issue,
          occurrenceCount: match?.occurrenceCount,
        })
      }
    })
  )

  pipelineLog(scanId, 'pattern-cache', `DONE — ${cacheHits} hits / ${needsAnalysis.length} misses`)

  if (needsAnalysis.length === 0) {
    pipelineLog(scanId, 'analyzeIssues', `DONE (all from cache) — ${total()}ms`)
    await logToScan(db, scanId, `AI analysis complete — ${cacheHits} issue(s) answered from pattern cache.`)
    return
  }

  // --- Step 2: deduplicate by fingerprint, then call Claude --------------------
  // Issues with the same fingerprint get the same analysis — one API call covers all.
  const uniqueByFp = new Map<string, IssueForAnalysis>()
  const fallbackByType = new Map<string, IssueForAnalysis>()

  for (const issue of needsAnalysis) {
    const key = issue.fingerprint ?? issue.type
    if (issue.fingerprint) {
      if (!uniqueByFp.has(issue.fingerprint)) uniqueByFp.set(issue.fingerprint, issue)
    } else {
      if (!fallbackByType.has(issue.type)) fallbackByType.set(issue.type, issue)
    }
  }

  const representatives = [
    ...uniqueByFp.values(),
    // Include type-only fallbacks that aren't already covered by a fingerprint
    ...[...fallbackByType.entries()]
      .filter(([type]) => ![...uniqueByFp.values()].some((i) => i.type === type))
      .map(([, issue]) => issue),
  ]

  // Build batch list before entering the loop so we know total batch count for logging
  const batches: IssueForAnalysis[][] = []
  for (let i = 0; i < representatives.length; i += AI_BATCH_SIZE) {
    batches.push(representatives.slice(i, i + AI_BATCH_SIZE))
  }

  pipelineLog(
    scanId, 'dedup',
    `${needsAnalysis.length} issues → ${representatives.length} unique representatives → ${batches.length} batch(es) ` +
    `(concurrency:${AI_BATCH_CONCURRENCY} batchSize:${AI_BATCH_SIZE})`
  )

  // --- Step 3: call Claude in parallel batches, persist immediately per batch --
  let totalIn = 0, totalOut = 0

  // Persist analysis to issues_enriched right after each batch resolves.
  // Avoids losing results if the lambda is killed before all batches finish.
  async function persistResults(batchReps: IssueForAnalysis[], results: Map<string, AIAnalysis>): Promise<void> {
    const coveredKeys = new Set(batchReps.map(r => r.fingerprint ?? r.type))
    await Promise.allSettled(
      needsAnalysis.filter(issue => coveredKeys.has(issue.fingerprint ?? issue.type)).map(async (issue) => {
        const cacheKey = issue.fingerprint ?? issue.type
        const analysis = results.get(cacheKey)
        if (!analysis) return
        const cat   = issueCategory(issue.type)
        const match = patternMatches.get(issue.id)
        const { error: upsertErr } = await db.from('issues_enriched').upsert({
          issue_id:       issue.id,
          summary:        analysis.summary,
          root_cause:     analysis.rootCause,
          fix_suggestion: analysis.fixSuggestion,
          confidence:     confidenceToFloat(analysis.confidence),
          analysis_data:  buildAnalysisData(issue, cat),
          model_version:  CLAUDE_HAIKU,
          from_pattern:   false,
          pattern_id:     match?.patternId ?? null,
          analyzed_at:    new Date().toISOString(),
        }, { onConflict: 'issue_id' })
        if (upsertErr) console.error('[ai-analyzer] issues_enriched upsert failed:', upsertErr.message)
      })
    )
  }

  // Run one batch: Claude call with solo fallback, fire-and-forget pattern updates,
  // immediate DB writes. Returns token counts for this batch only.
  async function runOneBatch(
    batch: IssueForAnalysis[],
    batchIdx: number,
    totalBatches: number,
  ): Promise<{ tokensIn: number; tokensOut: number }> {
    const batchLabel = `batch-${batchIdx + 1}of${totalBatches}`
    const elapsed    = perf()
    let bIn = 0, bOut = 0

    pipelineLog(scanId, batchLabel, `START — ${batch.length} representative(s): [${batch.map(r => r.type).join(', ')}]`)

    try {
      const { results: batchResults, tokensIn, tokensOut } = await analyzeBatch(
        appUrl, batch, frameworks, `${scanId.slice(0, 8)}/${batchLabel}`
      )
      bIn = tokensIn
      bOut = tokensOut

      const analyzed = batchResults.size
      const skipped  = batch.length - analyzed
      pipelineLog(
        scanId, batchLabel,
        `SUCCESS — ${elapsed()}ms — ${analyzed} analyzed${skipped > 0 ? ` / ${skipped} no-output` : ''} — ${tokensIn} in / ${tokensOut} out tokens`
      )

      for (const [cacheKey, analysis] of batchResults) {
        const rep = batch.find(r => (r.fingerprint ?? r.type) === cacheKey)
        if (rep) {
          const match = patternMatches.get(rep.id)
          if (match?.patternId && analysis.rootCause && analysis.fixSuggestion) {
            updatePatternTemplates(match.patternId, analysis.rootCause, analysis.fixSuggestion, CLAUDE_HAIKU)
              .catch(err => console.error('[ai-analyzer] pattern template update failed:', err))
          }
        }
      }
      await persistResults(batch, batchResults)
    } catch (err) {
      const batchMsg = err instanceof Error ? err.message : String(err)
      pipelineLog(scanId, batchLabel, `FAILED — ${elapsed()}ms — falling back to solo calls: ${batchMsg}`)

      const soloResults = new Map<string, AIAnalysis>()
      await Promise.allSettled(
        batch.map(async (rep) => {
          const cacheKey  = rep.fingerprint ?? rep.type
          const soloLabel = `${scanId.slice(0, 8)}/solo-${rep.type}`
          const soloTimer = perf()

          pipelineLog(scanId, `solo`, `START — type:${rep.type} key:${cacheKey}`)

          try {
            const soloResult = await callClaude({
              prompt:    buildSoloPrompt(appUrl, rep, frameworks),
              system:    ANALYSIS_SYSTEM_PROMPT,
              model:     CLAUDE_HAIKU,
              maxTokens: 350,
              timeoutMs: 30_000,
              label:     soloLabel,
            })
            if (!soloResult.ok) {
              logClaudeError(soloLabel, soloResult.error)
              pipelineLog(scanId, 'solo', `FAIL — type:${rep.type} — ${soloResult.error.message}`)
              await logToScan(db, scanId, `AI analysis failed for issue type "${rep.type}": ${soloResult.error.message}`)
              return
            }
            bIn  += soloResult.usage.inputTokens
            bOut += soloResult.usage.outputTokens
            const analysis = parseSoloResponse(soloResult.data)
            if (analysis.summary) {
              soloResults.set(cacheKey, analysis)
              pipelineLog(scanId, 'solo', `OK — type:${rep.type} — ${soloTimer()}ms — ${soloResult.usage.inputTokens} in / ${soloResult.usage.outputTokens} out`)
              const match = patternMatches.get(rep.id)
              if (match?.patternId && analysis.rootCause && analysis.fixSuggestion) {
                updatePatternTemplates(match.patternId, analysis.rootCause, analysis.fixSuggestion, CLAUDE_HAIKU)
                  .catch(e => console.error('[ai-analyzer] pattern template update failed:', e))
              }
            } else {
              pipelineLog(scanId, 'solo', `EMPTY — type:${rep.type} — Claude returned no summary`)
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            pipelineLog(scanId, 'solo', `FAIL — type:${rep.type} — ${soloTimer()}ms — ${msg}`)
            console.error(`[ai-analyzer] Solo call failed for ${cacheKey}:`, e)
          }
        })
      )
      if (soloResults.size > 0) await persistResults(batch, soloResults)
      await logToScan(db, scanId, `AI batch analysis failed, used per-issue fallback: ${batchMsg}`)
    }
    return { tokensIn: bIn, tokensOut: bOut }
  }

  // Run AI_BATCH_CONCURRENCY batches in parallel, then the next group, and so on.
  for (let i = 0; i < batches.length; i += AI_BATCH_CONCURRENCY) {
    const groupBatches = batches.slice(i, i + AI_BATCH_CONCURRENCY)
    const groupLabel   = `group-${Math.floor(i / AI_BATCH_CONCURRENCY) + 1}`

    pipelineLog(scanId, groupLabel, `START — ${groupBatches.length} batch(es) in parallel`)

    const groupResults = await Promise.allSettled(
      groupBatches.map((batch, j) => runOneBatch(batch, i + j, batches.length))
    )

    let groupIn = 0, groupOut = 0
    for (const r of groupResults) {
      if (r.status === 'fulfilled') {
        totalIn  += r.value.tokensIn
        totalOut += r.value.tokensOut
        groupIn  += r.value.tokensIn
        groupOut += r.value.tokensOut
      }
    }
    pipelineLog(scanId, groupLabel, `DONE — ${groupIn} in / ${groupOut} out tokens`)
  }

  if (totalIn > 0 || totalOut > 0) {
    await db.rpc('increment_scan_tokens', { p_scan_id: scanId, p_in: totalIn, p_out: totalOut })
      .then(({ error }) => { if (error) console.error('[ai-analyzer] token increment failed:', error.message) })
  }

  const elapsed = total()
  pipelineLog(
    scanId, 'analyzeIssues',
    `DONE — ${elapsed}ms — ${representatives.length} Claude call(s) — ` +
    `${needsAnalysis.length} analyzed + ${cacheHits} from cache — ` +
    `tokens: ${totalIn} in / ${totalOut} out`
  )

  await logToScan(
    db, scanId,
    `AI analysis complete — ${needsAnalysis.length} issue(s) analyzed, ${cacheHits} from pattern cache — ${Math.round(elapsed / 1000)}s`
  )
}

/**
 * Generate a holistic AI overview for the entire scan.
 * Reasons across ALL issues together — identifies clusters, symptoms vs root causes,
 * and regression vs the previous scan. Stored in scans.ai_overview.
 */
export async function generateScanOverview(
  scanId: string,
  appUrl: string,
  score: number,
  criticalCount: number,
  mediumCount: number,
  frameworks: string[] = [],
  lowCount = 0,
): Promise<void> {
  const elapsed = perf()

  pipelineLog(
    scanId, 'scanOverview',
    `START — score:${score} issues:(crit:${criticalCount} med:${mediumCount} low:${lowCount})`
  )

  if (!isClaudeConfigured()) {
    pipelineLog(scanId, 'scanOverview', 'SKIP — ANTHROPIC_API_KEY not set')
    return
  }
  if (criticalCount + mediumCount + lowCount === 0) {
    pipelineLog(scanId, 'scanOverview', 'SKIP — no issues')
    return
  }

  try {
    const db = getAdminClient()
    const { data: scanRow } = await db.from('scans').select('ai_overview').eq('id', scanId).maybeSingle()
    if (scanRow?.ai_overview) {
      pipelineLog(scanId, 'scanOverview', 'SKIP — overview already exists')
      return
    }

    // Parallel: fetch all issues + previous scan for regression data
    const [{ data: issueRows }, { data: prevScans }] = await Promise.all([
      db.from('issues')
        .select('type, severity, title, fingerprint')
        .eq('scan_id', scanId)
        .order('severity', { ascending: true }),
      db.from('scans')
        .select('id, score')
        .eq('url', appUrl)
        .eq('status', 'completed')
        .neq('id', scanId)
        .order('completed_at', { ascending: false })
        .limit(1),
    ])

    const issues: IssueOverviewItem[] = (issueRows ?? []).map(r => ({
      type:     r.type     as string,
      severity: r.severity as string,
      title:    r.title    as string,
    }))

    if (issues.length === 0) {
      pipelineLog(scanId, 'scanOverview', 'SKIP — issues query returned 0 rows')
      return
    }

    pipelineLog(scanId, 'scanOverview', `${issues.length} issues fetched — computing regression`)

    // Compute regression vs the previous completed scan for the same URL
    const currentFps = new Set(
      (issueRows ?? []).map(r => r.fingerprint as string | null).filter((f): f is string => Boolean(f))
    )

    let regressionNew = 0
    let regressionResolved = 0
    const previousScore: number | null = (prevScans?.[0]?.score as number | null) ?? null

    if (prevScans?.[0]) {
      const { data: prevIssues } = await db
        .from('issues')
        .select('fingerprint')
        .eq('scan_id', prevScans[0].id as string)
        .not('fingerprint', 'is', null)

      const prevFps = new Set(
        (prevIssues ?? []).map(r => r.fingerprint as string).filter(Boolean)
      )
      regressionNew      = [...currentFps].filter(fp => !prevFps.has(fp)).length
      regressionResolved = [...prevFps].filter(fp => !currentFps.has(fp)).length
      pipelineLog(scanId, 'scanOverview', `regression: +${regressionNew} new / -${regressionResolved} resolved vs prev score:${previousScore}`)
    } else {
      pipelineLog(scanId, 'scanOverview', 'regression: first scan for this URL')
    }

    pipelineLog(scanId, 'scanOverview', 'calling Claude for overview prose')

    const result = await callClaude({
      prompt:    buildOverviewPrompt(appUrl, score, issues, frameworks, {
        newCount:      regressionNew,
        resolvedCount: regressionResolved,
        previousScore,
      }),
      model:     CLAUDE_HAIKU,
      maxTokens: 300,
      label:     `${scanId.slice(0, 8)}/overview`,
    })

    if (!result.ok) {
      logClaudeError('scan-overview', result.error)
      pipelineLog(scanId, 'scanOverview', `FAIL — Claude error: ${result.error.message}`)
      return
    }

    const overview = result.data.trim()
    if (!overview) {
      pipelineLog(scanId, 'scanOverview', 'FAIL — Claude returned empty overview')
      return
    }

    await db.from('scans').update({
      ai_overview:          overview,
      regression_new:       regressionNew,
      regression_resolved:  regressionResolved,
    }).eq('id', scanId)

    await db.rpc('increment_scan_tokens', {
      p_scan_id: scanId,
      p_in:      result.usage.inputTokens,
      p_out:     result.usage.outputTokens,
    }).then(({ error }) => { if (error) console.error('[ai-analyzer] token increment failed:', error.message) })

    pipelineLog(
      scanId, 'scanOverview',
      `DONE — ${elapsed()}ms — regression:+${regressionNew}/-${regressionResolved} — ` +
      `tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    pipelineLog(scanId, 'scanOverview', `FAIL — ${elapsed()}ms — ${msg}`)
    console.error(`[ai-analyzer] Failed to generate overview for ${scanId}:`, err)
  }
}
