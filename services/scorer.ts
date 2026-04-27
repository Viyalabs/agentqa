import type { IssueSeverity, ScoreBreakdown } from '@/types'

// Deduction per issue by severity
const DEDUCTION_PER_ISSUE: Record<IssueSeverity, number> = {
  critical: 20,
  medium: 8,
  low: 2,
}

// Maximum total deduction per severity category
const MAX_DEDUCTION: Record<IssueSeverity, number> = {
  critical: 60,
  medium: 30,
  low: 10,
}

export function calculateScore(
  issues: Array<{ severity: IssueSeverity }>
): ScoreBreakdown {
  const criticalCount = issues.filter((i) => i.severity === 'critical').length
  const mediumCount = issues.filter((i) => i.severity === 'medium').length
  const lowCount = issues.filter((i) => i.severity === 'low').length

  const criticalDeduction = Math.min(
    criticalCount * DEDUCTION_PER_ISSUE.critical,
    MAX_DEDUCTION.critical
  )
  const mediumDeduction = Math.min(
    mediumCount * DEDUCTION_PER_ISSUE.medium,
    MAX_DEDUCTION.medium
  )
  const lowDeduction = Math.min(
    lowCount * DEDUCTION_PER_ISSUE.low,
    MAX_DEDUCTION.low
  )

  const total = criticalDeduction + mediumDeduction + lowDeduction
  const score = Math.max(0, 100 - total)

  return {
    score,
    criticalCount,
    mediumCount,
    lowCount,
    criticalDeduction,
    mediumDeduction,
    lowDeduction,
  }
}
