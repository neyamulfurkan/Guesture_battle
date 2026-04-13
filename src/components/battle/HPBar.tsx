'use client'

import { HP_LOW_THRESHOLD } from '@/lib/gameConstants'
import type { PlayerSide } from '@/types/game'
import { PillBadge } from '@/components/ui/Badge'

interface HPBarProps {
  currentHp: number
  maxHp: 100
  playerColor: string
  side: PlayerSide
}

export function HPBar({ currentHp, maxHp, playerColor, side: _side }: HPBarProps) {
  const pct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
  const isLow = currentHp <= HP_LOW_THRESHOLD
  const fillColor = isLow ? '#ef4444' : playerColor

  return (
    <div className="relative flex flex-col items-end" style={{ width: 'calc(100% - 24px)', margin: '0 12px' }}>
      {/* HP pill badge above right end */}
      <div className="mb-1">
        <span
          className="inline-flex items-center rounded-full font-bold border select-none px-2.5 py-1 text-[11px]"
          style={{
            backgroundColor: '#111827',
            borderColor: playerColor,
            color: playerColor,
          }}
        >
          {Math.ceil(currentHp)} HP
        </span>
      </div>

      {/* Bar track */}
      <div
        className="w-full rounded-sm overflow-hidden"
        style={{
          height: 10,
          background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        {/* Fill */}
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: isLow
              ? '#ef4444'
              : `linear-gradient(90deg, ${playerColor}99 0%, ${playerColor} 100%)`,
            transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1), background 300ms ease',
            animation: isLow ? 'glow-pulse 600ms ease-in-out infinite' : undefined,
            transformOrigin: 'left center',
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  )
}