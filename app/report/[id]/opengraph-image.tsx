import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'QA Report — AgentQA'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function ReportOGImage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let scanUrl = ''
  let score: number | null = null
  let totalPages = 0
  let criticalCount = 0
  let mediumCount = 0
  let lowCount = 0

  if (supabaseUrl && supabaseKey) {
    try {
      const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      }
      const [scanRes, issuesRes] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/scans?id=eq.${id}&select=url,score,total_pages&limit=1`,
          { headers }
        ),
        fetch(
          `${supabaseUrl}/rest/v1/issues?scan_id=eq.${id}&select=severity`,
          { headers }
        ),
      ])
      const [scans, issues] = await Promise.all([scanRes.json(), issuesRes.json()])
      const scan = scans?.[0]
      if (scan) {
        scanUrl = scan.url ?? ''
        score = scan.score ?? null
        totalPages = scan.total_pages ?? 0
      }
      if (Array.isArray(issues)) {
        criticalCount = issues.filter((i: { severity: string }) => i.severity === 'critical').length
        mediumCount = issues.filter((i: { severity: string }) => i.severity === 'medium').length
        lowCount = issues.filter((i: { severity: string }) => i.severity === 'low').length
      }
    } catch {
      // fallback to generic card
    }
  }

  const scoreColor =
    score === null ? '#71717A'
    : score >= 90 ? '#22C55E'
    : score >= 75 ? '#3B82F6'
    : score >= 50 ? '#F59E0B'
    : '#EF4444'

  const scoreLabel =
    score === null ? 'Scanning…'
    : score >= 90 ? 'Excellent'
    : score >= 75 ? 'Good'
    : score >= 50 ? 'Needs Work'
    : 'Critical Issues'

  let displayUrl = 'Your App'
  try {
    if (scanUrl) displayUrl = new URL(scanUrl).hostname.replace(/^www\./, '')
  } catch {
    // keep default
  }

  const totalIssues = criticalCount + mediumCount + lowCount

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0F',
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '56px 72px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            left: '30%',
            width: 500,
            height: 300,
            background: `radial-gradient(ellipse, ${scoreColor}18 0%, transparent 70%)`,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                ⚡
              </div>
              <span style={{ color: 'white', fontSize: 28, fontWeight: 700 }}>AgentQA</span>
            </div>
            <span
              style={{
                color: '#71717A',
                fontSize: 15,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '6px 16px',
              }}
            >
              QA Report
            </span>
          </div>

          {/* Main: score card + details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 72, flex: 1 }}>
            {/* Score circle */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.03)',
                border: `2px solid ${scoreColor}55`,
                borderRadius: 24,
                padding: '36px 52px',
                minWidth: 220,
              }}
            >
              <span style={{ color: scoreColor, fontSize: 100, fontWeight: 800, lineHeight: 1 }}>
                {score ?? '–'}
              </span>
              <span style={{ color: '#3F3F46', fontSize: 22, marginTop: 4 }}>/100</span>
              <span style={{ color: scoreColor, fontSize: 17, fontWeight: 600, marginTop: 14 }}>
                {scoreLabel}
              </span>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
              <div>
                <div style={{ color: '#71717A', fontSize: 16, marginBottom: 6 }}>Scanned site</div>
                <div style={{ color: 'white', fontSize: 32, fontWeight: 700 }}>{displayUrl}</div>
              </div>

              {/* Issue pills */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {criticalCount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.35)',
                      borderRadius: 10,
                      padding: '10px 20px',
                    }}
                  >
                    <span style={{ color: '#EF4444', fontSize: 24, fontWeight: 700 }}>{criticalCount}</span>
                    <span style={{ color: '#EF4444', fontSize: 14 }}>Critical</span>
                  </div>
                )}
                {mediumCount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.35)',
                      borderRadius: 10,
                      padding: '10px 20px',
                    }}
                  >
                    <span style={{ color: '#F59E0B', fontSize: 24, fontWeight: 700 }}>{mediumCount}</span>
                    <span style={{ color: '#F59E0B', fontSize: 14 }}>Medium</span>
                  </div>
                )}
                {lowCount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(59,130,246,0.1)',
                      border: '1px solid rgba(59,130,246,0.35)',
                      borderRadius: 10,
                      padding: '10px 20px',
                    }}
                  >
                    <span style={{ color: '#60A5FA', fontSize: 24, fontWeight: 700 }}>{lowCount}</span>
                    <span style={{ color: '#60A5FA', fontSize: 14 }}>Low</span>
                  </div>
                )}
                {totalIssues === 0 && score !== null && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.35)',
                      borderRadius: 10,
                      padding: '10px 20px',
                    }}
                  >
                    <span style={{ color: '#22C55E', fontSize: 16, fontWeight: 600 }}>✓ No issues found</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 24, color: '#52525B', fontSize: 16 }}>
                {totalPages > 0 && (
                  <span>{totalPages} page{totalPages !== 1 ? 's' : ''} scanned</span>
                )}
                {totalIssues > 0 && (
                  <span>{totalIssues} issue{totalIssues !== 1 ? 's' : ''} detected</span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ color: '#3B82F6', fontSize: 16, marginTop: 28 }}>
            qa.viyalabs.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
