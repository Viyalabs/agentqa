import Anthropic from '@anthropic-ai/sdk'
import { getAdminClient } from '@/lib/supabase'
import { updatePatternTemplates } from './pattern-matcher'
import type { IssueType, IssueSeverity, PatternMatchResult } from '@/types'

// Haiku: fast + cheap for post-scan analysis that runs in background
const MODEL      = 'claude-haiku-4-5-20251001'
const BATCH_SIZE = 8  // issues per Claude call; ~150 output tokens each = ~1200 max_tokens

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
}

function frameworkLabel(frameworks: string[]): string {
  if (frameworks.length === 0) return 'unknown stack'
  return frameworks.slice(0, 2).join(' + ')
}

/**
 * Build a single prompt covering up to BATCH_SIZE issues.
 * Shared context (persona, URL, stack) is written once — major token saving vs N individual prompts.
 */
function buildBatchPrompt(
  appUrl: string,
  issues: IssueForAnalysis[],
  frameworks: string[],
): string {
  const stack = frameworkLabel(frameworks)

  const issueLines = issues.map((issue, i) => {
    // Truncate details to 200 chars per issue in batch mode (vs 800 in solo mode)
    const details = issue.details
      ? JSON.stringify(issue.details).slice(0, 200)
      : 'none'
    return [
      `[${i + 1}] type:${issue.type}  severity:${issue.severity}`,
      `    title: ${issue.title}`,
      `    desc:  ${issue.description ?? 'none'}`,
      `    data:  ${details}`,
    ].join('\n')
  }).join('\n\n')

  return `You are an expert QA engineer. Analyze these ${issues.length} issues detected by an automated browser scanner.

App: ${appUrl}
Stack: ${stack}

${issueLines}

Return a JSON array with exactly ${issues.length} objects, one per issue in the same order:
[{"i":1,"summary":"1 sentence — what broke","root_cause":"technical reason","fix":"actionable steps"},...]

Rules: valid JSON only, no markdown fences, preserve issue order.`
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
  client: Anthropic,
  appUrl: string,
  issues: IssueForAnalysis[],
  frameworks: string[],
): Promise<Map<string, AIAnalysis>> {
  const message = await client.messages.create({
    model:      MODEL,
    max_tokens: Math.max(150 * issues.length, 300),
    messages:   [{ role: 'user', content: buildBatchPrompt(appUrl, issues, frameworks) }],
  })

  const text   = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const parsed = extractJSON(text) as Array<{ i: number; summary?: string; root_cause?: string; fix?: string }>

  if (!Array.isArray(parsed)) throw new TypeError('Batch response was not a JSON array')

  const result = new Map<string, AIAnalysis>()
  for (const item of parsed) {
    const rep = issues[item.i - 1]
    if (!rep) continue
    const summary      = item.summary?.trim()      ?? ''
    const rootCause    = item.root_cause?.trim()   ?? ''
    const fixSuggestion = item.fix?.trim()         ?? ''
    if (summary) {
      result.set(rep.fingerprint ?? rep.type, { summary, rootCause, fixSuggestion })
    }
  }
  return result
}

/** Single-issue fallback prompt (used when batch parsing fails for a specific item) */
function buildSoloPrompt(appUrl: string, issue: IssueForAnalysis, frameworks: string[]): string {
  const detailText = issue.details
    ? JSON.stringify(issue.details, null, 2).slice(0, 800)
    : 'none'
  return `You are an expert QA engineer reviewing a bug detected by an automated browser scanner.

App URL: ${appUrl}
Detected stack: ${frameworkLabel(frameworks)}
Issue type: ${issue.type}
Severity: ${issue.severity}
Title: ${issue.title}
Description: ${issue.description ?? 'none'}
Technical details: ${detailText}

Respond with exactly 3 lines:
SUMMARY: [1 sentence — what the user experienced or what broke]
ROOT_CAUSE: [1-2 sentences — the likely technical reason, specific to ${frameworkLabel(frameworks)} if relevant]
FIX: [specific, actionable steps a developer can take to resolve this]

Be precise and technical. No filler. Speak to the developer fixing it.`
}

function parseSoloResponse(text: string): AIAnalysis {
  const lines = text.trim().split('\n')
  let summary = '', rootCause = '', fixSuggestion = ''
  for (const line of lines) {
    if (line.startsWith('SUMMARY:'))         summary       = line.slice('SUMMARY:'.length).trim()
    else if (line.startsWith('ROOT_CAUSE:')) rootCause     = line.slice('ROOT_CAUSE:'.length).trim()
    else if (line.startsWith('FIX:'))        fixSuggestion = line.slice('FIX:'.length).trim()
  }
  return { summary, rootCause, fixSuggestion }
}

function buildOverviewPrompt(
  appUrl: string,
  score: number,
  totalIssues: number,
  criticalCount: number,
  mediumCount: number,
  frameworks: string[],
): string {
  const stackLine = frameworks.length > 0
    ? `Detected stack: ${frameworkLabel(frameworks)}\n`
    : ''

  return `You are a senior QA lead reviewing an automated scan of a web application.

App URL: ${appUrl}
${stackLine}QA Score: ${score}/100
Total issues: ${totalIssues} (${criticalCount} critical, ${mediumCount} medium)

Write a 2-3 sentence executive summary:
1. State the overall app health clearly
2. Call out the most urgent concern if any
3. Give one concrete recommendation specific to the stack if relevant

Be direct. Speak to a developer or technical founder.`
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
  severities: string[] = ['critical', 'medium', 'low'],
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
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

  const client = new Anthropic({ apiKey })

  // --- Step 1: apply cached templates from pattern DB (free, instant) ----------
  const needsAnalysis: IssueForAnalysis[] = []

  await Promise.allSettled(
    (issues as IssueForAnalysis[]).map(async (issue) => {
      const match = patternMatches.get(issue.id)
      if (match?.rootCauseTemplate && match?.fixTemplate) {
        // Pattern already has a solution — reuse it without calling Claude
        await db.from('issues').update({
          ai_summary:    `${issue.title} — see root cause below.`,
          root_cause:    match.rootCauseTemplate,
          fix_suggestion: match.fixTemplate,
        }).eq('id', issue.id)
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
      const batchResults = await analyzeBatch(client, appUrl, batch, frameworks)
      for (const [cacheKey, analysis] of batchResults) {
        analysisCache.set(cacheKey, analysis)
        const rep = batch.find((r) => (r.fingerprint ?? r.type) === cacheKey)
        if (rep) {
          const match = patternMatches.get(rep.id)
          if (match?.patternId && analysis.rootCause && analysis.fixSuggestion) {
            await updatePatternTemplates(match.patternId, analysis.rootCause, analysis.fixSuggestion)
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
            const message = await client.messages.create({
              model:      MODEL,
              max_tokens: 350,
              messages:   [{ role: 'user', content: buildSoloPrompt(appUrl, rep, frameworks) }],
            })
            const text     = message.content[0]?.type === 'text' ? message.content[0].text : ''
            const analysis = parseSoloResponse(text)
            if (analysis.summary) {
              analysisCache.set(cacheKey, analysis)
              const match = patternMatches.get(rep.id)
              if (match?.patternId && analysis.rootCause && analysis.fixSuggestion) {
                await updatePatternTemplates(match.patternId, analysis.rootCause, analysis.fixSuggestion)
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

      await db.from('issues').update({
        ai_summary:     analysis.summary,
        root_cause:     analysis.rootCause,
        fix_suggestion: analysis.fixSuggestion,
      }).eq('id', issue.id)
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
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return

  const totalIssues = criticalCount + mediumCount
  if (totalIssues === 0) return

  try {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: buildOverviewPrompt(appUrl, score, totalIssues, criticalCount, mediumCount, frameworks),
      }],
    })

    const overview = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    if (!overview) return

    const db = getAdminClient()
    await db.from('scans').update({ ai_overview: overview }).eq('id', scanId)

    console.log(`[ai-analyzer] ${scanId}: scan overview generated`)
  } catch (err) {
    console.error(`[ai-analyzer] Failed to generate overview for ${scanId}:`, err)
  }
}
