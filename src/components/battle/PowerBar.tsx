'use client'

import { PowerCard } from '@/components/battle/PowerCard'
import {
  POWER_COOLDOWN_FIRE_PUNCH,
  POWER_COOLDOWN_SHIELD,
  POWER_COOLDOWN_ZAP_SHOT,
  POWER_COOLDOWN_HEAL,
  POWER_COOLDOWN_ICE_FREEZE,
  POWER_COOLDOWN_DOUBLE_STRIKE,
  POWER_COOLDOWN_THUNDER_SMASH,
  POWER_COOLDOWN_FORCE_PUSH,
  POWER_COOLDOWN_DRAGON_BLAST,
  POWER_COOLDOWN_REFLECT_DOME,
} from '@/lib/gameConstants'
import type { PowerId } from '@/types/game'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const ALL_POWERS: PowerId[] = [
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
]

const POWER_COOLDOWN_MAP: Record<PowerId, number> = {
  fire_punch: POWER_COOLDOWN_FIRE_PUNCH,
  shield: POWER_COOLDOWN_SHIELD,
  zap_shot: POWER_COOLDOWN_ZAP_SHOT,
  heal: POWER_COOLDOWN_HEAL,
  ice_freeze: POWER_COOLDOWN_ICE_FREEZE,
  double_strike: POWER_COOLDOWN_DOUBLE_STRIKE,
  thunder_smash: POWER_COOLDOWN_THUNDER_SMASH,
  force_push: POWER_COOLDOWN_FORCE_PUSH,
  dragon_blast: POWER_COOLDOWN_DRAGON_BLAST,
  reflect_dome: POWER_COOLDOWN_REFLECT_DOME,
  full_restore: POWER_COOLDOWN_HEAL,
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getCooldownProgress(
  powerId: PowerId,
  cooldowns: Partial<Record<PowerId, number>>,
  now: number
): number {
  const lastUsed = cooldowns[powerId]
  if (lastUsed === undefined) return 1
  const cooldownMs = POWER_COOLDOWN_MAP[powerId]
  const elapsed = now - lastUsed
  return clamp(elapsed / cooldownMs, 0, 1)
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

interface PowerBarProps {
  unlockedPowers: PowerId[]
  cooldowns: Partial<Record<PowerId, number>>
  now: number
  onPowerSelect?: (power: PowerId) => void
  selectedPowerId?: PowerId | null
}

export function PowerBar({
  unlockedPowers,
  cooldowns,
  now,
  onPowerSelect,
  selectedPowerId,
}: PowerBarProps) {
  return (
    <div
      className="w-full flex items-center"
      style={{ height: 96 }}
    >
      <div
        className="flex gap-2 px-2 items-center"
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          height: '100%',
          width: '100%',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`
          .power-bar-scroll::-webkit-scrollbar { display: none; }
          @media (max-width: 639px) {
            .power-card-wrapper { width: calc(25vw - 16px) !important; height: calc(25vw - 16px) !important; }
          }
        `}</style>
        {ALL_POWERS.map((powerId) => {
          const isLocked = !unlockedPowers.includes(powerId)
          const cooldownProgress = getCooldownProgress(powerId, cooldowns, now)
          const isOnCooldown = !isLocked && cooldownProgress < 1

          return (
            <div
              key={powerId}
              className="power-card-wrapper flex-shrink-0"
              style={{
                width: 80,
                height: 80,
                scrollSnapAlign: 'start',
              }}
            >
              <PowerCard
                powerId={powerId}
                isOnCooldown={isOnCooldown}
                cooldownProgress={cooldownProgress}
                isLocked={isLocked}
                isSelected={selectedPowerId === powerId}
                onSelect={onPowerSelect ? () => onPowerSelect(powerId) : undefined}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}