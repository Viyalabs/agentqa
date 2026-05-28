import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'AgentQA — AI Reliability Platform for Web Apps | Viyalabs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0F',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '72px 80px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 400,
            background: 'radial-gradient(ellipse, rgba(59,130,246,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            ⚡
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: 'white', fontSize: 38, fontWeight: 700, letterSpacing: '-0.5px' }}>
              AgentQA
            </span>
            <span style={{ color: '#52525B', fontSize: 13, fontWeight: 400 }}>
              by Viyalabs · Chennai, India
            </span>
          </div>
          <span
            style={{
              color: '#60A5FA',
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 20,
              padding: '4px 12px',
              marginLeft: 4,
            }}
          >
            AI Reliability Platform
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            color: 'white',
            fontSize: 68,
            fontWeight: 800,
            textAlign: 'center',
            lineHeight: 1.05,
            letterSpacing: '-1.5px',
            marginBottom: 24,
          }}
        >
          The AI reliability layer{' '}
          <span
            style={{
              background: 'linear-gradient(90deg, #60A5FA, #22D3EE)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            for every deploy
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: '#A1A1AA',
            fontSize: 22,
            textAlign: 'center',
            maxWidth: 760,
            lineHeight: 1.5,
            marginBottom: 52,
          }}
        >
          Regression detection on every deploy. Real browser testing, AI root cause analysis,
          and CI/CD integration for modern software teams.
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          {[
            ['1,200+', 'Apps Scanned'],
            ['8,400+', 'Bugs Found'],
            ['< 2 min', 'Per Report'],
            ['100%', 'Free to Start'],
          ].map(([num, label], i) => (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px 44px',
                borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}
            >
              <span style={{ color: 'white', fontSize: 28, fontWeight: 700 }}>{num}</span>
              <span style={{ color: '#71717A', fontSize: 13, marginTop: 4 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* URL badge */}
        <div
          style={{
            marginTop: 36,
            color: '#3B82F6',
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: '0.3px',
          }}
        >
          agentqa.viyalabs.com
        </div>
      </div>
    ),
    { ...size }
  )
}
