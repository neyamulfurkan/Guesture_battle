'use client'

import { useRef, useEffect } from 'react'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { GESTURE_RETICLE_DWELL_MS } from '@/lib/gameConstants'

interface GestureReticleProps {
  position: { x: number; y: number } | null
  hoveredElementColor: string | null
  dwellProgress: number
}

const TRAIL_COUNT = 3
const CURSOR_SIZE = 20
const RING_SIZE = 48

export function GestureReticle({ position, hoveredElementColor, dwellProgress }: GestureReticleProps) {
  const trailRef = useRef<Array<{ x: number; y: number }>>([])

  useEffect(() => {
    if (!position) {
      trailRef.current = []
      return
    }
    trailRef.current = [position, ...trailRef.current].slice(0, TRAIL_COUNT)
  }, [position])

  if (!position) return null

  const trail = trailRef.current

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9000,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {trail.slice(1).map((pos, i) => {
        const opacity = 0.35 - i * 0.12
        const size = CURSOR_SIZE - (i + 1) * 3
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: pos.x - size / 2,
              top: pos.y - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, ' + opacity + ')',
              border: '1px solid rgba(59, 130, 246, ' + (opacity + 0.1) + ')',
              pointerEvents: 'none',
            }}
          />
        )
      })}

      <div
        style={{
          position: 'absolute',
          left: position.x - (hoveredElementColor ? RING_SIZE / 2 : CURSOR_SIZE / 2),
          top: position.y - (hoveredElementColor ? RING_SIZE / 2 : CURSOR_SIZE / 2),
          pointerEvents: 'none',
        }}
      >
        {hoveredElementColor && dwellProgress > 0 ? (
          <ProgressRing
            progress={dwellProgress}
            size={RING_SIZE}
            strokeWidth={3}
            color={hoveredElementColor}
            bgColor="rgba(255,255,255,0.1)"
          >
            <div
              style={{
                width: CURSOR_SIZE,
                height: CURSOR_SIZE,
                borderRadius: '50%',
                background: '#3b82f6',
                boxShadow: '0 0 8px 2px rgba(59,130,246,0.7)',
              }}
            />
          </ProgressRing>
        ) : (
          <div
            style={{
              width: CURSOR_SIZE,
              height: CURSOR_SIZE,
              borderRadius: '50%',
              background: '#3b82f6',
              boxShadow: '0 0 8px 2px rgba(59,130,246,0.7)',
            }}
          />
        )}
      </div>
    </div>
  )
}