'use client'

import { useEffect, useRef } from 'react'
import { HPBar } from '@/components/battle/HPBar'
import { PillBadge } from '@/components/ui/Badge'
import { PowerCard } from '@/components/battle/PowerCard'
import type { PlayerState } from '@/types/game'

interface PreBattleHalfProps {
  stream: MediaStream | null
  playerState: PlayerState
  isLocal: boolean
  side: 'left' | 'right'
}

const ALL_POWERS = [
  'fire_punch',
  'shield',
  'zap_shot',
  'heal',
  'ice_freeze',
  'double_strike',
  'thunder_smash',
  'force_push',
  'dragon_blast',
  'reflect_dome',
  'full_restore',
] as const

export function PreBattleHalf({ stream, playerState, isLocal, side }: PreBattleHalfProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const playerColor = isLocal ? '#3b82f6' : '#f97316'

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: '100%',
        height: '100%',
        background: '#050810',
      }}
    >
      {/* Full-height video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transform: isLocal ? 'scaleX(-1)' : undefined,
        }}
      />

      {/* Dark gradient overlay — top and bottom for readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(5,8,16,0.7) 0%, transparent 25%, transparent 60%, rgba(5,8,16,0.85) 100%)',
        }}
      />

      {/* Side edge indicator line */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          [side === 'left' ? 'right' : 'left']: 0,
          width: 2,
          background: `linear-gradient(to bottom, transparent, ${playerColor}66, transparent)`,
        }}
      />

      {/* HP Bar — top */}
      <div className="absolute top-3 left-0 right-0 z-10">
        <HPBar
          currentHp={playerState.hp}
          maxHp={100}
          playerColor={playerColor}
          side={isLocal ? 'local' : 'remote'}
        />
      </div>

      {/* Bottom section — power icons + name */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-2 pb-4 px-3">
        {/* Power icons row — 40×40px display-only */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {ALL_POWERS.map((powerId) => {
            const isUnlocked = playerState.unlockedPowers.includes(powerId)
            return (
              <div
                key={powerId}
                style={{ width: 40, height: 40, transform: 'scale(0.5)', transformOrigin: 'center center', margin: -10 }}
              >
                <PowerCard
                  powerId={powerId}
                  isOnCooldown={false}
                  cooldownProgress={1}
                  isLocked={!isUnlocked}
                  isSelected={false}
                />
              </div>
            )
          })}
        </div>

        {/* Player name + rank badge */}
        <div className="flex flex-col items-center gap-1">
          <PillBadge
            label={playerState.displayName}
            color={isLocal ? 'blue' : 'orange'}
            size="md"
          />
          {playerState.winStreak > 0 && (
            <PillBadge
              label={`🔥 ${playerState.winStreak} streak`}
              color="gold"
              size="sm"
            />
          )}
        </div>
      </div>

      {/* No stream fallback */}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-full animate-pulse"
              style={{
                width: 64,
                height: 64,
                background: 'rgba(59,130,246,0.15)',
                border: '2px solid rgba(59,130,246,0.4)',
              }}
            />
            <p className="text-white/50 text-sm">Connecting...</p>
          </div>
        </div>
      )}
    </div>
  )
}