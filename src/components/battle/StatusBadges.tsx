'use client'

import { useEffect, useRef } from 'react'
import { Shield, Flame, Zap, Heart, RefreshCw, Volume2, Target } from 'lucide-react'
import type { StatusEffect } from '@/types/game'
import { Badge } from '@/components/ui/Badge'

type AccentColor = 'blue' | 'purple' | 'orange' | 'cyan' | 'green' | 'red' | 'gold' | 'gray'

interface StatusConfig {
  label: string
  color: AccentColor
  Icon: React.ComponentType<{ size?: number | string; color?: string; [key: string]: unknown }>
}

const STATUS_CONFIG: Record<StatusEffect, StatusConfig> = {
  shield:  { label: 'Shield',   color: 'cyan',   Icon: Shield    },
  burning: { label: 'Burning',  color: 'orange',  Icon: Flame     },
  stunned: { label: 'Stunned',  color: 'purple',  Icon: Zap       },
  healing: { label: 'Healing',  color: 'green',   Icon: Heart     },
  reflect: { label: 'Reflect',  color: 'purple',  Icon: RefreshCw },
  war_cry: { label: 'War Cry',  color: 'orange',  Icon: Volume2   },
  focus:   { label: 'Focus',    color: 'gold',    Icon: Target    },
  frozen:  { label: 'Frozen',   color: 'cyan',    Icon: Shield    },
}

const COLOR_HEX: Record<AccentColor, string> = {
  blue:   '#3b82f6',
  purple: '#a855f7',
  orange: '#f97316',
  cyan:   '#06b6d4',
  green:  '#22c55e',
  red:    '#ef4444',
  gold:   '#eab308',
  gray:   '#94a3b8',
}

interface StatusBadgeItemProps {
  effect: StatusEffect
  isNew: boolean
}

function StatusBadgeItem({ effect, isNew }: StatusBadgeItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const config = STATUS_CONFIG[effect]

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    if (isNew) {
      el.style.opacity = '0'
      el.style.transform = 'scale(0.8)'
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 200ms ease-out, transform 200ms ease-out'
        el.style.opacity = '1'
        el.style.transform = 'scale(1)'
      })
    } else {
      el.style.opacity = '1'
      el.style.transform = 'scale(1)'
    }
  }, [isNew])

  const { Icon, color, label } = config
  const hex = COLOR_HEX[color]

  return (
    <div ref={ref} className="inline-flex items-center" style={{ opacity: 0 }}>
      <Badge
        label={label}
        color={color}
        size="sm"
      />
    </div>
  )
}

interface StatusBadgesProps {
  statusEffects: StatusEffect[]
}

export function StatusBadges({ statusEffects }: StatusBadgesProps) {
  const prevEffectsRef = useRef<Set<StatusEffect>>(new Set())

  const newEffects = new Set<StatusEffect>()
  for (const effect of statusEffects) {
    if (!prevEffectsRef.current.has(effect)) {
      newEffects.add(effect)
    }
  }

  useEffect(() => {
    prevEffectsRef.current = new Set(statusEffects)
  }, [statusEffects])

  if (statusEffects.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {statusEffects.map((effect) => (
        <StatusBadgeItem
          key={effect}
          effect={effect}
          isNew={newEffects.has(effect)}
        />
      ))}
    </div>
  )
}