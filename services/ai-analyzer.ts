import { getAdminClient } from '@/lib/supabase'
import { updatePatternTemplates } from './pattern-matcher'
import {
  callClaude,
  isClaudeConfigured,
  CLAUDE_HAIKU,
  CLAUDE_SONNET,
  logClaudeError,
  extractJSON,
  type ClaudeModel,
} from '@/services/ai/claude'
import { AI_BATCH_SIZE, AI_BATCH_CONCURRENCY, AI_MAX_REPRESENTATIVES_PER_SCAN } from '@/services/ai-config'
import type { IssueType, IssueSeverity, PatternMatchResult } from '@/types'

// Compressed system prompt — every token here multiplies across every call.
// Constraints expressed once here, not repeated in every user-turn prompt.
const ANALYSIS_SYSTEM_PROMPT =
  'Senior QA engineer diagnosing web app failures from automated scans. ' +
  'Use hedged language when evidence is partial ("likely caused by", "commonly occurs when"). ' +
  'Cite actual error messages, status codes, API names from data. Never invent technical details.'

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

// Confidence is now computed deterministically from evidence quality — not asked of Claude.
interface AIAnalysis {
  summary: string
  rootCause: string
  fixSuggestion: string
}

// ── Logging helpers ────────────────────────────────────────────────────────────

function perf(): () => number {
  const t0 = Date.now()
  return () => Date.now() - t0
}

function pipelineLog(scanId: string, phase: string, msg: string): void {
  console.log(`[ai-pipeline:${scanId}] [${phase}] ${msg}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    ? `\nFramework context:\n${active.map(h => `  ${h}`).join('\n')}`
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
    case 'JS_ERROR':      return '401/403=auth/permissions, 0=server unreachable, CORS, DNS; check error field'
    case 'NETWORK':       return 'stack origin, missing null-checks, polyfill gaps, app vs third-party code'
    case 'MOBILE':        return 'viewport meta tag, horizontal overflow at 375px, touch target size (44px min)'
    case 'PERFORMANCE':   return 'render-blocking scripts/CSS, uncompressed images, missing lazy loading, Cache-Control'
    case 'UI':            return 'broken asset URL path/casing, CDN origin, CSS overflow, 404 on nested route'
    case 'ACCESSIBILITY': return 'descriptive alt text required; alt="" for decorative; check CMS/component defaults'
    case 'SEO':           return 'unique 150-160 char meta description; og:image 1200×630; exactly one H1 per page'
    default:              return 'specific symptom observed, most likely root cause, concrete ordered fix steps'
  }
}

// ── Cost optimisation helpers ─────────────────────────────────────────────────

/**
 * Compute evidence-based confidence deterministically.
 * Avoids asking Claude to self-assess (saves output tokens, removes hallucinated confidence).
 * Score reflects how clearly the collected evidence points to a specific root cause.
 */
function computeConfidence(issue: IssueForAnalysis): number {
  const d = issue.details ?? {}
  switch (issue.type) {
    case 'js_error': {
      const stacks = (d.stacks as string[] | undefined) ?? []
      const errors = (d.errors as string[] | undefined) ?? []
      if (stacks.length > 0 && stacks[0].length > 20) return 0.85  // has usable stack trace
      if (errors.length > 0) return 0.65                            // error message only
      return 0.35
    }
    case 'network_failure': {
      const failures = (d.failures as Array<{ url?: string; status?: number }> | undefined) ?? []
      if (failures[0]?.status && failures[0].status > 0) return 0.90  // has HTTP status
      if (failures.length > 0) return 0.65
      return 0.40
    }
    case 'console_error':    return 0.60
    case 'missing_alt':
    case 'missing_meta':     return 0.90  // deterministic detection — high confidence
    case 'missing_image':    return 0.85
    case 'slow_load':
    case 'large_asset':      return 0.90
    case 'page_not_found':   return 0.95
    case 'mobile_layout':    return 0.70
    case 'broken_form':      return 0.65
    default:                 return 0.50
  }
}

/**
 * Tiered model selection.
 * Set AI_PREMIUM_MODEL=true in env to enable Sonnet for critical JS/network issues.
 * Default: always Haiku (cheapest, sufficient for most patterns).
 */
const AI_PREMIUM_MODEL_ENABLED = process.env.AI_PREMIUM_MODEL === 'true'

function selectModel(issue: IssueForAnalysis): ClaudeModel {
  if (AI_PREMIUM_MODEL_ENABLED && issue.severity === 'critical') {
    if (issue.type === 'js_error' || issue.type === 'network_failure') return CLAUDE_SONNET
  }
  return CLAUDE_HAIKU
}

function selectBatchModel(reps: IssueForAnalysis[]): ClaudeModel {
  if (AI_PREMIUM_MODEL_ENABLED) {
    if (reps.some(r => r.severity === 'critical' && (r.type === 'js_error' || r.type === 'network_failure'))) {
      return CLAUDE_SONNET
    }
  }
  return CLAUDE_HAIKU
}

/**
 * Issue types where multi-page instances produce identical root causes and fixes.
 * Collapsing them into one grouped representative = one Claude call instead of N.
 * Examples: missing_alt on 8 pages → 1 call covering all 8.
 */
const GROUPABLE_TYPES = new Set<IssueType>([
  'missing_alt',
  'missing_meta',
  'missing_image',
  'large_asset',
  'console_warning',
])

function groupedTitle(type: IssueType, count: number): string {
  const labels: Partial<Record<IssueType, string>> = {
    missing_alt:     'Missing alt text',
    missing_meta:    'Missing meta tags',
    missing_image:   'Missing images',
    large_asset:     'Oversized assets',
    console_warning: 'Console warnings',
  }
  const label = labels[type] ?? type.replace(/_/g, ' ')
  return `${label} (${count} page${count !== 1 ? 's' : ''} affected)`
}

/**
 * A representative issue after grouping. `coversKeys` is the set of all
 * fingerprint-or-type cache keys this representative covers — used by
 * persistResults to apply one analysis to many issues.
 */
interface FinalRep {
  issue: IssueForAnalysis
  cacheKey: string
  coversKeys: Set<string>
}

/**
 * Collapse same-type groupable representatives into one FinalRep each.
 * Non-groupable types pass through 1-to-1.
 *
 * Input is the already-deduplicated-by-fingerprint list of representatives.
 * Output is a shorter list where e.g. 8 missing_alt reps become 1 grouped rep.
 */
function buildFinalReps(representatives: IssueForAnalysis[]): FinalRep[] {
  const typeGroupMap = new Map<string, FinalRep>()
  const finalReps: FinalRep[] = []

  for (const rep of representatives) {
    const cacheKey = rep.fingerprint ?? rep.type
    if (GROUPABLE_TYPES.has(rep.type)) {
      const existing = typeGroupMap.get(rep.type)
      if (existing) {
        existing.coversKeys.add(cacheKey)
        existing.issue = {
          ...existing.issue,
          title: groupedTitle(rep.type, existing.coversKeys.size),
        }
        continue
      }
      const newRep: FinalRep = { issue: rep, cacheKey, coversKeys: new Set([cacheKey]) }
      typeGroupMap.set(rep.type, newRep)
      finalReps.push(newRep)
    } else {
      finalReps.push({ issue: rep, cacheKey, coversKeys: new Set([cacheKey]) })
    }
  }
  return finalReps
}

// ── Prompt builders ───────────────────────────────────────────────────────────

/**
 * Batch prompt covering up to AI_BATCH_SIZE issues.
 * Shared context written once — major token saving vs N individual prompts.
 * Confidence is NOT in the output schema — computed deterministically instead.
 */
function buildBatchPrompt(
  appUrl: string,
  issues: IssueForAnalysis[],
  frameworks: string[],
): string {
  const stack = frameworkLabel(frameworks)
  const seenCategories = [...new Set(issues.map(i => issueCategory(i.type)))]
  const hintLines = seenCategories
    .map(cat => `  ${cat}: ${issueCategoryHint(cat)}`)
    .join('\n')
  const fwContext = frameworkGuidance(frameworks)

  const issueLines = issues.map((issue, i) => {
    const cat = issueCategory(issue.type)
    const patternLine = issue.occurrenceCount && issue.occurrenceCount > 2
      ? `\n    pattern: seen ${issue.occurrenceCount}× across scans`
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

Category hints:
${hintLines}

Issues:
${issueLines}

Cite evidence from data. Hedge uncertainty. Never invent. Fix steps use ${stack} idioms.

[{"i":1,"summary":"1 sentence — what the user experiences","root_cause":"1-2 sentences citing evidence","fix":["step 1","step 2"]},...]

IMPORTANT: Return ONLY the raw JSON array. Start with [ and end with ]. No markdown, no backticks.`
}

/**
 * Analyze a batch of representative issues in a single Claude call.
 * Returns a map of cacheKey → AIAnalysis for each successfully analyzed issue.
 */
async function analyzeBatch(
  appUrl: string,
  issues: IssueForAnalysis[],
  frameworks: string[],
  batchLabel: string,
  model: ClaudeModel = CLAUDE_HAIKU,
): Promise<{ results: Map<string, AIAnalysis>; tokensIn: number; tokensOut: number }> {
  const claudeResult = await callClaude({
    prompt:    buildBatchPrompt(appUrl, issues, frameworks),
    system:    ANALYSIS_SYSTEM_PROMPT,
    model,
    maxTokens: Math.max(160 * issues.length, 400),
    timeoutMs: 45_000,
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
      result.set(rep.fingerprint ?? rep.type, { summary, rootCause, fixSuggestion })
    }
  }
  return { results: result, tokensIn, tokensOut }
}

/** Single-issue fallback prompt. Confidence removed — computed deterministically. */
function buildSoloPrompt(appUrl: string, issue: IssueForAnalysis, frameworks: string[]): string {
  const detailText = extractDetails(issue, 400)
  const category   = issueCategory(issue.type)
  const guidance   = issueTypeGuidance(category)
  const stack      = frameworkLabel(frameworks)
  const fwContext  = frameworkGuidance(frameworks)
  const patternCtx = issue.occurrenceCount && issue.occurrenceCount > 2
    ? `\nPattern: seen ${issue.occurrenceCount}× across scans — recurring.`
    : ''

  return `App: ${appUrl}
Stack: ${stack}${fwContext}
Category: ${category} | Type: ${issue.type} | Severity: ${issue.severity}
Title: ${issue.title}
Description: ${issue.description ?? 'none'}
Data: ${detailText}${patternCtx}

FOCUS: ${guidance}

Cite evidence. Hedge uncertainty. Never invent. Fix steps use ${stack} idioms.

{"summary":"...","root_cause":"...","fix":["step 1","step 2"]}`
}

function parseSoloResponse(text: string): AIAnalysis {
  const parsed = extractJSON(text) as {
    summary?: string
    root_cause?: string
    fix?: string | string[]
  }
  const fixRaw = parsed.fix
  const fixSuggestion = Array.isArray(fixRaw)
    ? fixRaw.map((s, idx) => `${idx + 1}. ${s}`).join('\n')
    : (fixRaw?.trim() ?? '')
  return {
    summary:      parsed.summary?.trim()    ?? '',
    rootCause:    parsed.root_cause?.trim() ?? '',
    fixSuggestion,
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

// ── DB helpers ────────────────────────────────────────────────────────────────

async function logToScan(db: ReturnType<typeof getAdminClient>, scanId: string, message: string): Promise<void> {
  try {
    await db.from('scan_logs').insert({ scan_id: scanId, message })
  } catch { /* non-fatal */ }
}

// ── Core analysis pipeline ────────────────────────────────────────────────────

/**
 * Analyze all issues for a completed scan.
 *
 * Optimisation layers (outermost → innermost):
 *
 * 1. Pattern cache  — if the pattern DB already has root_cause_template + fix_template
 *    for this fingerprint, write it directly to issues_enriched (zero Claude cost).
 *
 * 2. Fingerprint dedup — issues with the same fingerprint share one Claude call.
 *
 * 3. Type-based grouping — GROUPABLE_TYPES (missing_alt, missing_meta, etc.) collapsed
 *    into one representative per type: e.g. 8 pages of missing_alt → 1 call.
 *
 * 4. Budget cap — cap to AI_MAX_REPRESENTATIVES_PER_SCAN unique analyses, sorted by
 *    severity (critical first) so the highest-impact issues are always within budget.
 *
 * 5. Batching — AI_BATCH_SIZE issues per Claude call, AI_BATCH_CONCURRENCY in parallel.
 *
 * 6. Model tiering — Haiku for most issues; Sonnet opt-in (AI_PREMIUM_MODEL=true)
 *    for critical JS/network crashes only.
 *
 * 7. Deterministic confidence — computed from evidence quality, never asked of Claude.
 *
 * After fresh analysis, templates are written back to the pattern DB so future scans
 * get cache hits for the same fingerprint.
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
    console.error(`[ai-analyzer] ${scanId}: issues_with_analysis query failed — ${error.message}`)
    await logToScan(db, scanId, `AI analysis skipped — DB query error: ${error.message}`)
    return
  }

  const alreadyAnalyzed = (eligibleTotal ?? 0) - (issues?.length ?? 0)

  if (!issues || issues.length === 0) {
    pipelineLog(
      scanId, 'analyzeIssues',
      `SKIP — all ${eligibleTotal ?? 0} eligible issue(s) already analyzed`
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

  // ── Layer 1: Pattern cache (free, instant) ───────────────────────────────────
  const needsAnalysis: IssueForAnalysis[] = []
  let cacheHits = 0

  await Promise.allSettled(
    (issues as IssueForAnalysis[]).map(async (issue) => {
      const match = patternMatches.get(issue.id)
      if (match?.rootCauseTemplate && match?.fixTemplate && !match.needsRefresh) {
        cacheHits++
        pipelineLog(scanId, 'pattern-cache', `HIT  issue:${issue.id} type:${issue.type}`)
        await db.from('issues_enriched').upsert({
          issue_id:         issue.id,
          summary:          issue.description?.slice(0, 200) ?? issue.title,
          root_cause:       match.rootCauseTemplate,
          fix_suggestion:   match.fixTemplate,
          confidence:       computeConfidence(issue),
          analysis_data:    { tags: [issue.type, issue.severity], category: issueCategory(issue.type) },
          model_version:    CLAUDE_HAIKU,
          from_pattern:     true,
          pattern_id:       match.patternId,
          analyzed_at:      new Date().toISOString(),
        }, { onConflict: 'issue_id' })
      } else {
        const reason = !match ? 'no-pattern' : match.needsRefresh ? 'needs-refresh' : 'no-template'
        pipelineLog(scanId, 'pattern-cache', `MISS issue:${issue.id} type:${issue.type} reason:${reason}`)
        needsAnalysis.push({ ...issue, occurrenceCount: match?.occurrenceCount })
      }
    })
  )

  pipelineLog(scanId, 'pattern-cache', `DONE — ${cacheHits} hits / ${needsAnalysis.length} misses`)

  if (needsAnalysis.length === 0) {
    pipelineLog(scanId, 'analyzeIssues', `DONE (all from cache) — ${total()}ms`)
    await logToScan(db, scanId, `AI analysis complete — ${cacheHits} issue(s) answered from pattern cache.`)
    return
  }

  // ── Layer 2: Fingerprint dedup ───────────────────────────────────────────────
  const uniqueByFp  = new Map<string, IssueForAnalysis>()
  const fallbackByType = new Map<string, IssueForAnalysis>()

  for (const issue of needsAnalysis) {
    if (issue.fingerprint) {
      if (!uniqueByFp.has(issue.fingerprint)) uniqueByFp.set(issue.fingerprint, issue)
    } else {
      if (!fallbackByType.has(issue.type)) fallbackByType.set(issue.type, issue)
    }
  }

  const representatives = [
    ...uniqueByFp.values(),
    ...[...fallbackByType.entries()]
      .filter(([type]) => ![...uniqueByFp.values()].some((i) => i.type === type))
      .map(([, issue]) => issue),
  ]

  // ── Layer 3: Type-based grouping of repetitive issue types ──────────────────
  // e.g. missing_alt on 8 pages (8 fingerprints) → 1 FinalRep covers all 8.
  const finalReps = buildFinalReps(representatives)

  // ── Layer 4: Budget cap — highest severity first ──────────────────────────────
  const SEVERITY_ORDER: Record<string, number> = { critical: 0, medium: 1, low: 2 }
  const sortedReps = [...finalReps].sort(
    (a, b) => (SEVERITY_ORDER[a.issue.severity] ?? 3) - (SEVERITY_ORDER[b.issue.severity] ?? 3)
  )
  const budgetedReps = sortedReps.slice(0, AI_MAX_REPRESENTATIVES_PER_SCAN)
  const budgetDropped = finalReps.length - budgetedReps.length

  // ── Layer 5: Batching ────────────────────────────────────────────────────────
  const batches: FinalRep[][] = []
  for (let i = 0; i < budgetedReps.length; i += AI_BATCH_SIZE) {
    batches.push(budgetedReps.slice(i, i + AI_BATCH_SIZE))
  }

  pipelineLog(
    scanId, 'dedup+group',
    `${needsAnalysis.length} issues → ${representatives.length} fingerprint-unique → ` +
    `${finalReps.length} after grouping → ${budgetedReps.length} after budget cap` +
    (budgetDropped > 0 ? ` (${budgetDropped} dropped, increase AI_MAX_REPRESENTATIVES_PER_SCAN to include)` : '') +
    ` → ${batches.length} batch(es) (concurrency:${AI_BATCH_CONCURRENCY} batchSize:${AI_BATCH_SIZE})`
  )

  // ── Persistence helper ───────────────────────────────────────────────────────
  // For each issue in needsAnalysis covered by this batch's FinalReps, write results.
  // Supports grouped reps: if issue's key is in rep.coversKeys, it gets the rep's analysis.
  async function persistBatchResults(
    batch: FinalRep[],
    results: Map<string, AIAnalysis>,
    modelVersion: string,
  ): Promise<void> {
    // Build the full set of keys this batch covers (direct + grouped)
    const coveredKeys = new Set<string>()
    for (const rep of batch) {
      rep.coversKeys.forEach(k => coveredKeys.add(k))
    }

    await Promise.allSettled(
      needsAnalysis
        .filter(issue => coveredKeys.has(issue.fingerprint ?? issue.type))
        .map(async (issue) => {
          const issueCacheKey = issue.fingerprint ?? issue.type
          // Find which rep in this batch covers this issue's key
          const coveringRep = batch.find(rep => rep.coversKeys.has(issueCacheKey))
          if (!coveringRep) return
          const analysis = results.get(coveringRep.cacheKey)
          if (!analysis) return

          const cat   = issueCategory(issue.type)
          const match = patternMatches.get(issue.id)
          const { error: upsertErr } = await db.from('issues_enriched').upsert({
            issue_id:       issue.id,
            summary:        analysis.summary,
            root_cause:     analysis.rootCause,
            fix_suggestion: analysis.fixSuggestion,
            confidence:     computeConfidence(issue),  // deterministic evidence-based score
            analysis_data:  buildAnalysisData(issue, cat),
            model_version:  modelVersion,
            from_pattern:   false,
            pattern_id:     match?.patternId ?? null,
            analyzed_at:    new Date().toISOString(),
          }, { onConflict: 'issue_id' })
          if (upsertErr) console.error('[ai-analyzer] issues_enriched upsert failed:', upsertErr.message)
        })
    )
  }

  // ── Batch execution ──────────────────────────────────────────────────────────
  let totalIn = 0, totalOut = 0

  async function runOneBatch(
    batch: FinalRep[],
    batchIdx: number,
    totalBatches: number,
  ): Promise<{ tokensIn: number; tokensOut: number }> {
    const batchLabel   = `batch-${batchIdx + 1}of${totalBatches}`
    const elapsed      = perf()
    const batchIssues  = batch.map(r => r.issue)
    const batchModel   = selectBatchModel(batchIssues)
    let bIn = 0, bOut = 0

    pipelineLog(
      scanId, batchLabel,
      `START — ${batch.length} rep(s): [${batchIssues.map(r => r.type).join(', ')}] model:${batchModel}`
    )

    try {
      const { results: batchResults, tokensIn, tokensOut } = await analyzeBatch(
        appUrl, batchIssues, frameworks,
        `${scanId.slice(0, 8)}/${batchLabel}`,
        batchModel,
      )
      bIn = tokensIn
      bOut = tokensOut

      const analyzed = batchResults.size
      const skipped  = batch.length - analyzed
      pipelineLog(
        scanId, batchLabel,
        `SUCCESS — ${elapsed()}ms — ${analyzed} analyzed${skipped > 0 ? ` / ${skipped} no-output` : ''} — ${tokensIn}in/${tokensOut}out`
      )

      // Write pattern templates for future cache hits (fire-and-forget)
      for (const [cacheKey, analysis] of batchResults) {
        const rep   = batch.find(r => r.cacheKey === cacheKey)
        const match = rep ? patternMatches.get(rep.issue.id) : undefined
        if (match?.patternId && analysis.rootCause && analysis.fixSuggestion) {
          updatePatternTemplates(match.patternId, analysis.rootCause, analysis.fixSuggestion, batchModel)
            .catch(err => console.error('[ai-analyzer] pattern template update failed:', err))
        }
      }
      await persistBatchResults(batch, batchResults, batchModel)
    } catch (err) {
      const batchMsg = err instanceof Error ? err.message : String(err)
      pipelineLog(scanId, batchLabel, `FAILED — ${elapsed()}ms — falling back to solo calls: ${batchMsg}`)

      const soloResults = new Map<string, AIAnalysis>()
      await Promise.allSettled(
        batch.map(async (rep) => {
          const soloModel  = selectModel(rep.issue)
          const soloLabel  = `${scanId.slice(0, 8)}/solo-${rep.issue.type}`
          const soloTimer  = perf()

          pipelineLog(scanId, 'solo', `START — type:${rep.issue.type} key:${rep.cacheKey} model:${soloModel}`)

          try {
            const soloResult = await callClaude({
              prompt:    buildSoloPrompt(appUrl, rep.issue, frameworks),
              system:    ANALYSIS_SYSTEM_PROMPT,
              model:     soloModel,
              maxTokens: 300,
              timeoutMs: 30_000,
              label:     soloLabel,
            })
            if (!soloResult.ok) {
              logClaudeError(soloLabel, soloResult.error)
              pipelineLog(scanId, 'solo', `FAIL — type:${rep.issue.type} — ${soloResult.error.message}`)
              await logToScan(db, scanId, `AI analysis failed for "${rep.issue.type}": ${soloResult.error.message}`)
              return
            }
            bIn  += soloResult.usage.inputTokens
            bOut += soloResult.usage.outputTokens
            const analysis = parseSoloResponse(soloResult.data)
            if (analysis.summary) {
              soloResults.set(rep.cacheKey, analysis)
              pipelineLog(
                scanId, 'solo',
                `OK — type:${rep.issue.type} — ${soloTimer()}ms — ${soloResult.usage.inputTokens}in/${soloResult.usage.outputTokens}out`
              )
              const match = patternMatches.get(rep.issue.id)
              if (match?.patternId && analysis.rootCause && analysis.fixSuggestion) {
                updatePatternTemplates(match.patternId, analysis.rootCause, analysis.fixSuggestion, soloModel)
                  .catch(e => console.error('[ai-analyzer] pattern template update failed:', e))
              }
            } else {
              pipelineLog(scanId, 'solo', `EMPTY — type:${rep.issue.type} — Claude returned no summary`)
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            pipelineLog(scanId, 'solo', `FAIL — type:${rep.issue.type} — ${soloTimer()}ms — ${msg}`)
          }
        })
      )
      if (soloResults.size > 0) {
        // Convert solo results Map (keyed by rep cacheKey) to persistBatchResults format
        await persistBatchResults(batch, soloResults, CLAUDE_HAIKU)
      }
      await logToScan(db, scanId, `AI batch analysis failed, used per-issue fallback: ${batchMsg}`)
    }
    return { tokensIn: bIn, tokensOut: bOut }
  }

  // Run AI_BATCH_CONCURRENCY batches in parallel, then the next group
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
    pipelineLog(scanId, groupLabel, `DONE — ${groupIn}in/${groupOut}out tokens`)
  }

  if (totalIn > 0 || totalOut > 0) {
    await db.rpc('increment_scan_tokens', { p_scan_id: scanId, p_in: totalIn, p_out: totalOut })
      .then(({ error }) => { if (error) console.error('[ai-analyzer] token increment failed:', error.message) })
  }

  const elapsed = total()
  pipelineLog(
    scanId, 'analyzeIssues',
    `DONE — ${elapsed}ms — ${budgetedReps.length} unique representative(s) analyzed — ` +
    `${needsAnalysis.length} issues covered (${cacheHits} from cache) — tokens: ${totalIn}in/${totalOut}out`
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
      maxTokens: 280,
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
      `DONE — ${elapsed()}ms — regression:+${regressionNew}/-${regressionResolved} — tokens: ${result.usage.inputTokens}in/${result.usage.outputTokens}out`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    pipelineLog(scanId, 'scanOverview', `FAIL — ${elapsed()}ms — ${msg}`)
    console.error(`[ai-analyzer] Failed to generate overview for ${scanId}:`, err)
  }
}
