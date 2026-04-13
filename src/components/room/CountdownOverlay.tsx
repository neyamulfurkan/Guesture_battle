'use client'

import { useEffect, useRef, useState } from 'react'
import { COUNTDOWN_START } from '@/lib/gameConstants'

interface CountdownOverlayProps {
  count: number | 'FIGHT!' | null
}

export function CountdownOverlay({ count }: CountdownOverlayProps) {
  const [animKey, setAnimKey] = useState(0)
  const [showFlash, setShowFlash] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (count === null) return

    setAnimKey(prev => prev + 1)

    if (count === 'FIGHT!') {
      setShowFlash(true)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => {
        setShowFlash(false)
      }, 150)
    }

    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [count])

  if (count === null) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
        pointerEvents: 'none',
      }}
    >
      {showFlash && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.15)',
            animation: 'fight-flash 150ms ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      )}

      {typeof count === 'number' ? (
        <span
          key={animKey}
          style={{
            fontSize: '96px',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1,
            textShadow:
              '0 0 40px rgba(255,255,255,0.9), 0 0 80px rgba(59,130,246,0.6), 0 0 120px rgba(59,130,246,0.3)',
            animation: 'countdown-scale 500ms cubic-bezier(0.25,0.46,0.45,0.94) forwards',
            display: 'inline-block',
            userSelect: 'none',
          }}
        >
          {count}
        </span>
      ) : (
        <span
          key={animKey}
          style={{
            fontSize: '72px',
            fontWeight: 700,
            lineHeight: 1,
            background: 'linear-gradient(90deg, #3b82f6 0%, #a855f7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 32px rgba(59,130,246,0.7)) drop-shadow(0 0 64px rgba(168,85,247,0.4))',
            animation: 'countdown-scale 800ms cubic-bezier(0.25,0.46,0.45,0.94) forwards',
            display: 'inline-block',
            userSelect: 'none',
          }}
        >
          FIGHT!
        </span>
      )}
    </div>
  )
}