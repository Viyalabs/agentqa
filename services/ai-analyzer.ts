import Anthropic from '@anthropic-ai/sdk'
import { getAdminClient } from '@/lib/supabase'
import type { IssueType, IssueSeverity } from '@/types'

// Use Haiku for speed and cost — analysis runs post-scan, not on critical path
const MODEL = 'claude-haiku-4-5-20251001'

interface IssueForAnalysis {
  id: string
  type: IssueType
  severity: IssueSeverity
  title: string
  description: string | null
  details: Record<string, unknown> | null
}

interface AIAnalysis {
  summary: string
  rootCause: string
  fixSuggestion: string
}

function buildIssuePrompt(
  appUrl: string,
  issue: IssueForAnalysis,
): string {
  // Truncate details to avoid huge prompts
  const detailText = issue.details
    ? JSON.stringify(issue.details, null, 2).slice(0, 800)
    : 'none'

  return `You are an expert QA engineer reviewing a bug detected by an automated browser scanner.

App URL: ${appUrl}
Issue type: ${issue.type}
Severity: ${issue.severity}
Title: ${issue.title}
Description: ${issue.description ?? 'none'}
Technical details: ${detailText}

Respond with exactly 3 lines:
SUMMARY: [1 sentence — what the user experienced or what broke]
ROOT_CAUSE: [1-2 sentences — the likely technical reason this happened]
FIX: [specific, actionable steps for a developer to resolve this]

Be precise and technical. No filler. Speak to the developer fixing it.`
}

function buildOverviewPrompt(
  appUrl: string,
  score: number,
  totalIssues: number,
  criticalCount: number,
  mediumCount: number,
): string {
  return `You are a senior QA lead reviewing an automated scan of a web application.

App URL: ${appUrl}
QA Score: ${score}/100
Total issues: ${totalIssues} (${criticalCount} critical, ${mediumCount} medium)

Write a 2-3 sentence executive summary:
1. State the overall app health clearly
2. Call out the most urgent concern if any
3. Give one concrete recommendation

Be direct. Speak to a developer or technical founder.`
}

function parseAnalysis(text: string): AIAnalysis {
  const lines = text.trim().split('\n')
  let summary = ''
  let rootCause = ''
  let fixSuggestion = ''

  for (const line of lines) {
    if (line.startsWith('SUMMARY:')) {
      summary = line.slice('SUMMARY:'.length).trim()
    } else if (line.startsWith('ROOT_CAUSE:')) {
      rootCause = line.slice('ROOT_CAUSE:'.length).trim()
    } else if (line.startsWith('FIX:')) {
      fixSuggestion = line.slice('FIX:'.length).trim()
    }
  }

  return { summary, rootCause, fixSuggestion }
}

/**
 * Analyze all issues for a completed scan.
 * Deduplicates by issue type — each unique type is analyzed once,
 * then the result is applied to all issues of that type.
 * Runs post-scan and never blocks scan completion.
 */
export async function analyzeIssues(
  scanId: string,
  appUrl: string,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[ai-analyzer] ANTHROPIC_API_KEY not set — skipping issue analysis')
    return
  }

  const db = getAdminClient()

  // Fetch issues that haven't been analyzed yet
  const { data: issues, error } = await db
    .from('issues')
    .select('id, type, severity, title, description, details')
    .eq('scan_id', scanId)
    .is('ai_summary', null)

  if (error || !issues || issues.length === 0) return

  const client = new Anthropic({ apiKey })

  // Analyze each unique issue type once (avoids redundant API calls)
  const uniqueByType = new Map<string, IssueForAnalysis>()
  for (const issue of issues as IssueForAnalysis[]) {
    if (!uniqueByType.has(issue.type)) {
      uniqueByType.set(issue.type, issue)
    }
  }

  const typeResults = new Map<string, AIAnalysis>()

  await Promise.allSettled(
    [...uniqueByType.entries()].map(async ([type, representative]) => {
      try {
        const message = await client.messages.create({
          model: MODEL,
          max_tokens: 300,
          messages: [{ role: 'user', content: buildIssuePrompt(appUrl, representative) }],
        })

        const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
        const analysis = parseAnalysis(text)

        if (analysis.summary) {
          typeResults.set(type, analysis)
        }
      } catch (err) {
        console.error(`[ai-analyzer] Failed to analyze type ${type}:`, err)
      }
    })
  )

  // Persist results — each issue gets its type's analysis
  await Promise.allSettled(
    (issues as IssueForAnalysis[]).map(async (issue) => {
      const analysis = typeResults.get(issue.type)
      if (!analysis) return

      await db
        .from('issues')
        .update({
          ai_summary: analysis.summary,
          root_cause: analysis.rootCause,
          fix_suggestion: analysis.fixSuggestion,
        })
        .eq('id', issue.id)
    })
  )

  console.log(
    `[ai-analyzer] ${scanId}: analyzed ${typeResults.size} issue type(s) across ${issues.length} issue(s)`
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
      messages: [
        {
          role: 'user',
          content: buildOverviewPrompt(appUrl, score, totalIssues, criticalCount, mediumCount),
        },
      ],
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
