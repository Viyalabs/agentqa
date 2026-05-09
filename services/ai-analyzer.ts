import { getAdminClient } from '@/lib/supabase'
import { updatePatternTemplates } from './pattern-matcher'
import { callClaude, isClaudeConfigured, CLAUDE_HAIKU, logClaudeError } from '@/services/ai/claude'
import type { IssueType, IssueSeverity, PatternMatchResult } from '@/types'

const BATCH_SIZE = 14 // issues per Claude call; ~170 output tokens each = ~2380 max_tokens

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
      const msg    = errors[0]?.slice(0, 120) ?? ''
      const stack  = (d.stacks as string[] | undefined)?.[0]?.split('\n')[1]?.trim().slice(0, 80) ?? ''
      return [msg, stack ? `at ${stack}` : ''].filter(Boolean).join(' ').slice(0, limit) || 'none'
    }
    case 'console_error':
    case 'console_warning': {
      const errors = (d.errors as string[] | undefined) ?? []
      return errors.slice(0, 3).map(e => e.slice(0, 90)).join(' | ').slice(0, limit) || 'none'
    }
    case 'network_failure': {
      const failures = (d.failures as Array<{ url?: string; method?: string; status?: number }> | undefined) ?? []
      return failures.slice(0, 3).map(f =>
        `${f.method ?? 'GET'} ${String(f.url ?? '').slice(0, 60)} [${f.status ?? '?'}]`
      ).join(' | ').slice(0, limit) || 'none'
    }
    case 'slow_load':
      return `loadTime:${(d.loadTimeMs as number | undefined) ?? '?'}ms`
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
      return 'HTTP status code meaning, CORS policy headers, request timeout vs connection refused, CDN misconfiguration, DNS resolution. Distinguish client-side fetch failures from server errors.'
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

  const issueLines = issues.map((issue, i) => {
    return [
      `[${i + 1}] ${issueCategory(issue.type)}/${issue.type}/${issue.severity}`,
      `    title: ${issue.title}`,
      `    desc:  ${issue.description ?? 'none'}`,
      `    data:  ${extractDetails(issue, 180)}`,
    ].join('\n')
  }).join('\n\n')

  return `You are an expert web developer analyzing automated QA scan findings.

App: ${appUrl}
Stack: ${stack}

CONSTRAINTS:
- Only state what the evidence in "data" supports. If uncertain, set confidence to "low".
- root_cause must name a specific technical reason, not a generic statement.
- Never invent error codes, file paths, or function names absent from the data.
- summary: 1 sentence — what broke from the user's perspective.
- root_cause: 1-2 sentences — specific technical explanation tied to the stack.
- fix: array of 2-4 concrete ordered steps the developer can act on immediately.
- confidence: "low" | "medium" | "high" based on data richness.

Issues:
${issueLines}

Return a JSON array with exactly ${issues.length} objects in the same order:
[{"i":1,"summary":"...","root_cause":"...","fix":["step 1","step 2"],"confidence":"high"},...]

Valid JSON only. No markdown fences. Preserve issue order.`
}

/** Three-pass JSON extraction: direct → fenced → bare object/array */
function extractJSON(text: string): unknown {
  try { return JSON.parse(text) } catch { /* fall through */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) { try { return JSON.parse(fenced[1].trim()) } catch { /* fall through */ } }
  const bare = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  if (bare?.[1]) { try { return JSON.parse(bare[1]) } catch { /* fall through */ } }
  throw new SyntaxError(`No JSON found in response (first 200 chars): ${text.slice(0, 200)}`)
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
): Promise<Map<string, AIAnalysis>> {
  const claudeResult = await callClaude({
    prompt:    buildBatchPrompt(appUrl, issues, frameworks),
    model:     CLAUDE_HAIKU,
    maxTokens: Math.max(170 * issues.length, 400),
    timeoutMs: 60_000,
  })
  if (!claudeResult.ok) {
    logClaudeError('batch-analysis', claudeResult.error)
    throw new Error(claudeResult.error.message)
  }
  const text = claudeResult.data
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
  return result
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
{"summary":"Login button throws an unhandled TypeError on mobile Safari","root_cause":"The click handler calls event.composedPath() which returns undefined in Safari <14. The polyfill is absent from the mobile bundle.","fix":["Add a composedPath polyfill to the app entry point","Or rewrite the handler to use event.target with a null guard","Verify fix on BrowserStack Safari 13 and 14"],"confidence":"high"}

Respond with only the JSON object. No markdown, no extra text.`
}

function parseSoloResponse(text: string): AIAnalysis {
  // Try JSON first (new format), fall back to line-prefix format
  try {
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
  } catch {
    const lines = text.trim().split('\n')
    let summary = '', rootCause = '', fixSuggestion = ''
    for (const line of lines) {
      if (line.startsWith('SUMMARY:'))         summary       = line.slice('SUMMARY:'.length).trim()
      else if (line.startsWith('ROOT_CAUSE:')) rootCause     = line.slice('ROOT_CAUSE:'.length).trim()
      else if (line.startsWith('FIX:'))        fixSuggestion = line.slice('FIX:'.length).trim()
    }
    return { summary, rootCause, fixSuggestion, confidence: 'low' }
  }
}

function buildOverviewPrompt(
  appUrl: string,
  score: number,
  totalIssues: number,
  criticalCount: number,
  mediumCount: number,
  frameworks: string[],
): string {
  const stackLine = frameworks.length > 0 ? `Stack: ${frameworkLabel(frameworks)}\n` : ''
  const health = score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor'

  return `You are a senior engineering lead reviewing a QA scan report.

App: ${appUrl}
${stackLine}Score: ${score}/100 (${health})
Issues: ${totalIssues} total — ${criticalCount} critical, ${mediumCount} medium

Write 2-3 sentences:
1. Overall health with score context — state the number, don't just say "some issues".
2. Most urgent concern — be specific (e.g. "3 JS errors crash checkout" not "there are critical issues").
3. One concrete next step tied to the detected stack.

CONSTRAINTS: No filler ("it seems", "looks like", "please note"). No bullet points. Plain prose. Speak to the technical lead who will act on this today.`
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
  if (!isClaudeConfigured()) {
    console.warn('[ai-analyzer] ANTHROPIC_API_KEY not set — skipping issue analysis')
    return
  }

  const db = getAdminClient()

  const { data: issues, error } = await db
    .from('issues')
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
        // Pattern already has a solution — reuse it without calling Claude
        await db.from('issues').update({
          ai_summary:    `${issue.title} — see root cause below.`,
          root_cause:    match.rootCauseTemplate,
          fix_suggestion: match.fixTemplate,
        }).eq('id', issue.id)

        // Write full record to issues_enriched for analytics + future queries
        await db.from('issues_enriched').upsert({
          issue_id:         issue.id,
          summary:          `${issue.title} — see root cause below.`,
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

  for (let i = 0; i < representatives.length; i += BATCH_SIZE) {
    const batch = representatives.slice(i, i + BATCH_SIZE)
    try {
      const batchResults = await analyzeBatch(appUrl, batch, frameworks)
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
      console.warn(`[ai-analyzer] Batch failed, falling back to individual calls:`, err)
      await Promise.allSettled(
        batch.map(async (rep) => {
          const cacheKey = rep.fingerprint ?? rep.type
          try {
            const soloResult = await callClaude({
              prompt:    buildSoloPrompt(appUrl, rep, frameworks),
              model:     CLAUDE_HAIKU,
              maxTokens: 300,
              timeoutMs: 30_000,
            })
            if (!soloResult.ok) {
              logClaudeError('solo-analysis', soloResult.error)
              throw new Error(soloResult.error.message)
            }
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
    }
  }

  // --- Step 3: persist analysis to all issues that needed it -------------------
  await Promise.allSettled(
    needsAnalysis.map(async (issue) => {
      const cacheKey = issue.fingerprint ?? issue.type
      const analysis = analysisCache.get(cacheKey)
      if (!analysis) return

      // Keep flat columns on issues for backward compatibility with existing queries
      await db.from('issues').update({
        ai_summary:     analysis.summary,
        root_cause:     analysis.rootCause,
        fix_suggestion: analysis.fixSuggestion,
      }).eq('id', issue.id)

      // Write full enrichment record to issues_enriched
      const cat   = issueCategory(issue.type)
      const match = patternMatches.get(issue.id)
      await db.from('issues_enriched').upsert({
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
        .then(({ error }) => {
          if (error) console.error('[ai-analyzer] issues_enriched upsert failed:', error.message)
        })
    })
  )

  console.log(
    `[ai-analyzer] ${scanId}: ${representatives.length} Claude call(s) → ` +
    `${needsAnalysis.length} issue(s) analyzed (${reused} reused from patterns)`
  )
}

/**
 * Generate a one-paragraph AI overview for the entire scan.
 * Stored in scans.ai_overview. Runs after analyzeIssues.
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

  const totalIssues = criticalCount + mediumCount + lowCount
  if (totalIssues === 0) return

  try {
    const db = getAdminClient()
    const { data: scanRow } = await db.from('scans').select('ai_overview').eq('id', scanId).maybeSingle()
    if (scanRow?.ai_overview) {
      console.log(`[ai-analyzer] ${scanId}: overview already exists — skipping`)
      return
    }

    const result = await callClaude({
      prompt:    buildOverviewPrompt(appUrl, score, totalIssues, criticalCount, mediumCount, frameworks),
      model:     CLAUDE_HAIKU,
      maxTokens: 160,
    })

    if (!result.ok) {
      logClaudeError('scan-overview', result.error)
      return
    }

    const overview = result.data.trim()
    if (!overview) return

    await db.from('scans').update({ ai_overview: overview }).eq('id', scanId)

    console.log(`[ai-analyzer] ${scanId}: scan overview generated`)
  } catch (err) {
    console.error(`[ai-analyzer] Failed to generate overview for ${scanId}:`, err)
  }
}
