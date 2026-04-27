import { calculateScore } from '../services/scorer'

describe('calculateScore', () => {
  it('returns 100 with no issues', () => {
    const { score } = calculateScore([])
    expect(score).toBe(100)
  })

  it('deducts 20 per critical issue', () => {
    const { score } = calculateScore([{ severity: 'critical' }])
    expect(score).toBe(80)

    const { score: s2 } = calculateScore([
      { severity: 'critical' },
      { severity: 'critical' },
    ])
    expect(s2).toBe(60)
  })

  it('deducts 8 per medium issue', () => {
    const { score } = calculateScore([{ severity: 'medium' }])
    expect(score).toBe(92)

    const { score: s2 } = calculateScore([
      { severity: 'medium' },
      { severity: 'medium' },
    ])
    expect(s2).toBe(84)
  })

  it('deducts 2 per low issue', () => {
    const { score } = calculateScore([{ severity: 'low' }])
    expect(score).toBe(98)
  })

  it('caps critical deductions at 60', () => {
    const issues = Array.from({ length: 10 }, () => ({ severity: 'critical' as const }))
    const { score, criticalDeduction } = calculateScore(issues)
    expect(criticalDeduction).toBe(60)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('caps medium deductions at 30', () => {
    const issues = Array.from({ length: 10 }, () => ({ severity: 'medium' as const }))
    const { mediumDeduction } = calculateScore(issues)
    expect(mediumDeduction).toBe(30)
  })

  it('caps low deductions at 10', () => {
    const issues = Array.from({ length: 20 }, () => ({ severity: 'low' as const }))
    const { lowDeduction } = calculateScore(issues)
    expect(lowDeduction).toBe(10)
  })

  it('never returns a score below 0', () => {
    const issues = [
      ...Array.from({ length: 5 }, () => ({ severity: 'critical' as const })),
      ...Array.from({ length: 10 }, () => ({ severity: 'medium' as const })),
      ...Array.from({ length: 20 }, () => ({ severity: 'low' as const })),
    ]
    const { score } = calculateScore(issues)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('returns correct breakdown counts', () => {
    const issues = [
      { severity: 'critical' as const },
      { severity: 'critical' as const },
      { severity: 'medium' as const },
      { severity: 'low' as const },
      { severity: 'low' as const },
    ]
    const result = calculateScore(issues)
    expect(result.criticalCount).toBe(2)
    expect(result.mediumCount).toBe(1)
    expect(result.lowCount).toBe(2)
  })

  it('handles mixed severity correctly', () => {
    const issues = [
      { severity: 'critical' as const }, // -20
      { severity: 'medium' as const },   // -8
      { severity: 'low' as const },      // -2
    ]
    const { score } = calculateScore(issues)
    expect(score).toBe(70) // 100 - 20 - 8 - 2
  })
})
