'use client'

import { useEffect, useRef, useState } from 'react'
import { PlayerState } from '@/types/game'
import { PillBadge } from '@/components/ui/Badge'

// StarRating inline since FILE 058 was not found
function StarRating({ hpRemaining }: { hpRemaining: number }) {
  const count = hpRemaining > 70 ? 3 : hpRemaining >= 30 ? 2 : 1
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((i) => (
        <svg key={i} width="24" height="24" viewBox="0 0 24 24" fill="none">
          <polygon
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
            fill={i <= count ? '#eab308' : 'rgba(255,255,255,0.2)'}
            stroke={i <= count ? '#eab308' : 'rgba(255,255,255,0.1)'}
            strokeWidth="1"
          />
        </svg>
      ))}
    </div>
  )
}

const ENCOURAGING_MESSAGES = [
  'Every legend starts somewhere. Rise again.',
  'The battle is lost, but the war is yours.',
  'Defeat is just data. Learn and conquer.',
  'Your hands will remember. Try again.',
  'The best fighters fall the most. Keep going.',
  'One loss sharpens a thousand victories.',
  'Power awaits those who refuse to quit.',
  'The arena respects those who return.',
  'Pain is temporary. Glory is permanent.',
  'You fought with heart. That counts.',
  'Next round, they won\'t see you coming.',
  'Champions are built in moments like this.',
]

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

interface PlayerResultProps {
  playerState: PlayerState
  isWinner: boolean
  xpEarned: number
  stream: MediaStream | null
}

export function PlayerResult({ playerState, isWinner, xpEarned, stream }: PlayerResultProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mounted, setMounted] = useState(false)

  const encouragingMessage = ENCOURAGING_MESSAGES[hashId(playerState.id) % ENCOURAGING_MESSAGES.length]

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  if (isWinner) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 px-4 py-8"
        style={{ width: '60%' }}
      >
        {/* Rotating gold outer ring + video circle */}
        <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
          {/* Spinning conic ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, #eab308, #fde68a, #eab308, #92400e, #eab308)',
              animation: 'spin 3s linear infinite',
              padding: 4,
              borderRadius: '50%',
            }}
          />
          {/* Dark gap ring */}
          <div
            className="absolute rounded-full"
            style={{
              inset: 4,
              background: '#050810',
              borderRadius: '50%',
              zIndex: 1,
            }}
          />
          {/* Video circle */}
          <div
            className="absolute rounded-full overflow-hidden"
            style={{
              inset: 8,
              zIndex: 2,
              border: '4px solid #eab308',
              borderRadius: '50%',
              boxShadow: '0 0 24px rgba(234,179,8,0.5), 0 0 48px rgba(234,179,8,0.2)',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: 'block',
              }}
            />
            {!stream && (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: '#0d1117' }}
              >
                <span style={{ fontSize: 32 }}>👤</span>
              </div>
            )}
          </div>
        </div>

        {/* VICTORY */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#eab308',
            letterSpacing: 6,
            textShadow: '0 0 24px rgba(234,179,8,0.6), 0 0 48px rgba(234,179,8,0.3)',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 600ms ease',
          }}
        >
          VICTORY
        </div>

        {/* Player name */}
        <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
          {playerState.displayName}
        </div>

        {/* Star rating */}
        <StarRating hpRemaining={playerState.hp} />

        {/* XP earned */}
        <div className="flex items-center gap-2">
          <PillBadge label="XP" color="green" size="sm" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
            +{xpEarned} XP earned
          </span>
        </div>

        {/* HP remaining */}
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {playerState.hp} HP remaining
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Loser
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-4 py-8"
      style={{ width: '40%' }}
    >
      {/* Grayscale video circle */}
      <div className="relative flex items-center justify-center" style={{ width: 156, height: 156 }}>
        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            border: '3px solid #94a3b8',
            borderRadius: '50%',
            filter: 'grayscale(100%)',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              display: 'block',
            }}
          />
          {!stream && (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: '#0d1117' }}
            >
              <span style={{ fontSize: 28 }}>👤</span>
            </div>
          )}
        </div>
      </div>

      {/* DEFEATED */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#94a3b8',
          letterSpacing: 4,
          opacity: mounted ? 1 : 0,
          transition: 'opacity 600ms ease',
        }}
      >
        DEFEATED
      </div>

      {/* Player name */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
        {playerState.displayName}
      </div>

      {/* XP earned */}
      <div className="flex items-center gap-1.5">
        <PillBadge label="XP" color="gray" size="sm" />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>+{xpEarned} XP</span>
      </div>

      {/* Encouraging message */}
      <div
        style={{
          fontSize: 12,
          color: 'rgba(148,163,184,0.7)',
          textAlign: 'center',
          maxWidth: 180,
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}
      >
        "{encouragingMessage}"
      </div>
    </div>
  )
}