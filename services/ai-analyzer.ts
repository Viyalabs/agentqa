import { getAdminClient } from '@/lib/supabase'
import { updatePatternTemplates } from './pattern-matcher'
import { callClaude, isClaudeConfigured, CLAUDE_HAIKU, logClaudeError, extractJSON } from '@/services/ai/claude'
import { AI_BATCH_SIZE } from '@/services/ai-config'
import type { IssueType, IssueSeverity, PatternMatchResult } from '@/types'

const ANALYSIS_SYSTEM_PROMPT =
  'You are a senior web developer analyzing automated QA scan findings. ' +
  'Be precise: cite specific status codes, DOM APIs, and property names. ' +
  'Never invent function names, file paths, or error codes absent from the provided data.'

interface IssueForAnalysis {
  id: string
  type: IssueType
  severity: IssueSeverity
  title: string
  description: string | null
  details: Record<string, unknown> | null
  fingerprint: string | null
}

interface AIAnalysis {
  summary: string
  rootCause: string
  fixSuggestion: string
  confidence: string   // "low" | "medium" | "high" — from Claude's self-assessment
}

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

  const issueLines = issues.map((issue, i) => {
    const cat = issueCategory(issue.type)
    return [
      `[${i + 1}] ${cat} | ${issue.type} | ${issue.severity}`,
      `    title: ${issue.title}`,
      `    desc:  ${issue.description ?? 'none'}`,
      `    data:  ${extractDetails(issue, 240)}`,
    ].join('\n')
  }).join('\n\n')

  return `App: ${appUrl}
Stack: ${stack}

Category hints (apply to matching issues):
${hintLines}

CONSTRAINTS:
- Only state what the evidence in "data" supports. If uncertain, set confidence to "low".
- root_cause must name a specific technical reason (API name, status code, property), not a generic statement.
- Never invent error codes, file paths, or function names absent from the data.
- confidence: "high" = data clearly identifies cause; "medium" = partial evidence; "low" = data is thin or ambiguous.
- summary: 1 sentence — what broke from the user's perspective.
- root_cause: 1-2 sentences — specific technical explanation tied to the stack.
- fix: array of 2-4 concrete ordered steps the developer can act on immediately.

Issues:
${issueLines}

Return a JSON array with exactly ${issues.length} objects in the same order:
[{"i":1,"summary":"...","root_cause":"...","fix":["step 1","step 2"],"confidence":"high"},...]

Valid JSON only. No markdown fences. Preserve issue order.`
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
): Promise<{ results: Map<string, AIAnalysis>; tokensIn: number; tokensOut: number }> {
  const claudeResult = await callClaude({
    prompt:    buildBatchPrompt(appUrl, issues, frameworks),
    system:    ANALYSIS_SYSTEM_PROMPT,
    model:     CLAUDE_HAIKU,
    maxTokens: Math.max(200 * issues.length, 600),
    timeoutMs: 60_000,
  })
  if (!claudeResult.ok) {
    logClaudeError('batch-analysis', claudeResult.error)
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

  return `You are an expert web developer analyzing a QA scan finding.

App: ${appUrl}
Stack: ${stack}
Category: ${category}
Issue type: ${issue.type}
Severity: ${issue.severity}
Title: ${issue.title}
Description: ${issue.description ?? 'none'}
Technical data: ${detailText}

FOCUS: ${guidance}

CONSTRAINTS:
- Only state what the evidence in "Technical data" supports. If data is thin, set confidence to "low".
- root_cause must name a specific technical reason tied to the stack, not a generic statement.
- Never invent error codes, file paths, or function names absent from the data above.
- summary: 1 sentence — what the user experienced or what broke.
- root_cause: 1-2 sentences — specific technical explanation.
- fix: array of 2-4 concrete ordered steps the developer can act on immediately.
- confidence: "low" | "medium" | "high" based on how much the data confirms your analysis.

Example:
{"summary":"Users see a blank screen when navigating to the checkout page","root_cause":"The async fetchCartItems() call is not awaited — it resolves after the first render commits, throwing an unhandled rejection that crashes the component tree.","fix":["Add await to the fetchCartItems() call inside the data-loading hook","Wrap the call in try/catch and render an error boundary on rejection","Add a loading skeleton that prevents rendering until the Promise resolves"],"confidence":"high"}

Respond with only the JSON object. No markdown, no extra text.`
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
  const db = getAdminClient()

  if (!isClaudeConfigured()) {
    console.warn('[ai-analyzer] ANTHROPIC_API_KEY not set — skipping issue analysis')
    await logToScan(db, scanId, 'AI analysis skipped — ANTHROPIC_API_KEY not configured.')
    return
  }

  // Query via the view so ai_summary reflects issues_enriched (not the stale flat column)
  const { data: issues, error } = await db
    .from('issues_with_analysis')
    .select('id, type, severity, title, description, details, fingerprint')
    .eq('scan_id', scanId)
    .in('severity', severities)
    .is('ai_summary', null)

  if (error || !issues || issues.length === 0) return

  // --- Step 1: apply cached templates from pattern DB (free, instant) ----------
  const needsAnalysis: IssueForAnalysis[] = []

  await Promise.allSettled(
    (issues as IssueForAnalysis[]).map(async (issue) => {
      const match = patternMatches.get(issue.id)
      if (match?.rootCauseTemplate && match?.fixTemplate && !match.needsRefresh) {
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
        needsAnalysis.push(issue)
      }
    })
  )

  const reused = issues.length - needsAnalysis.length
  if (reused > 0) {
    console.log(`[ai-analyzer] ${scanId}: reused pattern templates for ${reused} issue(s)`)
  }

  if (needsAnalysis.length === 0) return

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

  // fingerprint (or type fallback) → analysis result
  const analysisCache = new Map<string, AIAnalysis>()
  let totalIn = 0, totalOut = 0

  for (let i = 0; i < representatives.length; i += AI_BATCH_SIZE) {
    const batch = representatives.slice(i, i + AI_BATCH_SIZE)
    try {
      const { results: batchResults, tokensIn, tokensOut } = await analyzeBatch(appUrl, batch, frameworks)
      totalIn  += tokensIn
      totalOut += tokensOut
      for (const [cacheKey, analysis] of batchResults) {
        analysisCache.set(cacheKey, analysis)
        const rep = batch.find((r) => (r.fingerprint ?? r.type) === cacheKey)
        if (rep) {
          const match = patternMatches.get(rep.id)
          if (match?.patternId && analysis.rootCause && analysis.fixSuggestion) {
            await updatePatternTemplates(match.patternId, analysis.rootCause, analysis.fixSuggestion, CLAUDE_HAIKU)
              .catch((err) => console.error('[ai-analyzer] pattern template update failed:', err))
          }
        }
      }
    } catch (err) {
      const batchMsg = err instanceof Error ? err.message : String(err)
      console.warn(`[ai-analyzer] Batch failed, falling back to individual calls:`, err)
      await Promise.allSettled(
        batch.map(async (rep) => {
          const cacheKey = rep.fingerprint ?? rep.type
          try {
            const soloResult = await callClaude({
              prompt:    buildSoloPrompt(appUrl, rep, frameworks),
              system:    ANALYSIS_SYSTEM_PROMPT,
              model:     CLAUDE_HAIKU,
              maxTokens: 350,
              timeoutMs: 30_000,
            })
            if (!soloResult.ok) {
              logClaudeError('solo-analysis', soloResult.error)
              await logToScan(db, scanId, `AI analysis failed for issue type "${rep.type}": ${soloResult.error.message}`)
              throw new Error(soloResult.error.message)
            }
            totalIn  += soloResult.usage.inputTokens
            totalOut += soloResult.usage.outputTokens
            const analysis = parseSoloResponse(soloResult.data)
            if (analysis.summary) {
              analysisCache.set(cacheKey, analysis)
              const match = patternMatches.get(rep.id)
              if (match?.patternId && analysis.rootCause && analysis.fixSuggestion) {
                await updatePatternTemplates(match.patternId, analysis.rootCause, analysis.fixSuggestion, CLAUDE_HAIKU)
                  .catch((e) => console.error('[ai-analyzer] pattern template update failed:', e))
              }
            }
          } catch (e) {
            console.error(`[ai-analyzer] Solo call failed for ${cacheKey}:`, e)
          }
        })
      )
      // Only log the batch failure to scan_logs once (not per-issue)
      await logToScan(db, scanId, `AI batch analysis failed, used per-issue fallback: ${batchMsg}`)
    }
  }

  // --- Step 3: persist analysis to issues_enriched ----------------------------
  await Promise.allSettled(
    needsAnalysis.map(async (issue) => {
      const cacheKey = issue.fingerprint ?? issue.type
      const analysis = analysisCache.get(cacheKey)
      if (!analysis) return

      const cat   = issueCategory(issue.type)
      const match = patternMatches.get(issue.id)
      const { error: upsertErr } = await db.from('issues_enriched').upsert({
        issue_id:        issue.id,
        summary:         analysis.summary,
        root_cause:      analysis.rootCause,
        fix_suggestion:  analysis.fixSuggestion,
        confidence:      confidenceToFloat(analysis.confidence),
        analysis_data:   buildAnalysisData(issue, cat),
        model_version:   CLAUDE_HAIKU,
        from_pattern:    false,
        pattern_id:      match?.patternId ?? null,
        analyzed_at:     new Date().toISOString(),
      }, { onConflict: 'issue_id' })
      if (upsertErr) console.error('[ai-analyzer] issues_enriched upsert failed:', upsertErr.message)
    })
  )

  if (totalIn > 0 || totalOut > 0) {
    await db.rpc('increment_scan_tokens', { p_scan_id: scanId, p_in: totalIn, p_out: totalOut })
      .then(({ error }) => { if (error) console.error('[ai-analyzer] token increment failed:', error.message) })
  }

  console.log(
    `[ai-analyzer] ${scanId}: ${representatives.length} Claude call(s) → ` +
    `${needsAnalysis.length} issue(s) analyzed (${reused} reused from patterns) ` +
    `— tokens: ${totalIn} in / ${totalOut} out`
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
  if (!isClaudeConfigured()) return
  if (criticalCount + mediumCount + lowCount === 0) return

  try {
    const db = getAdminClient()
    const { data: scanRow } = await db.from('scans').select('ai_overview').eq('id', scanId).maybeSingle()
    if (scanRow?.ai_overview) {
      console.log(`[ai-analyzer] ${scanId}: overview already exists — skipping`)
      return
    }

    // Fetch all issues so the prompt can reason across the full picture
    const { data: issueRows } = await db
      .from('issues')
      .select('type, severity, title, fingerprint')
      .eq('scan_id', scanId)
      .order('severity', { ascending: true })

    const issues: IssueOverviewItem[] = (issueRows ?? []).map(r => ({
      type:     r.type     as string,
      severity: r.severity as string,
      title:    r.title    as string,
    }))

    if (issues.length === 0) return

    // Compute regression vs the previous completed scan for the same URL
    const currentFps = new Set(
      (issueRows ?? []).map(r => r.fingerprint as string | null).filter((f): f is string => Boolean(f))
    )

    const { data: prevScans } = await db
      .from('scans')
      .select('id, score')
      .eq('url', appUrl)
      .eq('status', 'completed')
      .neq('id', scanId)
      .order('completed_at', { ascending: false })
      .limit(1)

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
    }

    const result = await callClaude({
      prompt:    buildOverviewPrompt(appUrl, score, issues, frameworks, {
        newCount:      regressionNew,
        resolvedCount: regressionResolved,
        previousScore,
      }),
      model:     CLAUDE_HAIKU,
      maxTokens: 300,
    })

    if (!result.ok) {
      logClaudeError('scan-overview', result.error)
      return
    }

    const overview = result.data.trim()
    if (!overview) return

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

    console.log(
      `[ai-analyzer] ${scanId}: overview generated — ` +
      `${regressionNew} new / ${regressionResolved} resolved vs prev scan — ` +
      `tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`
    )
  } catch (err) {
    console.error(`[ai-analyzer] Failed to generate overview for ${scanId}:`, err)
  }
}
