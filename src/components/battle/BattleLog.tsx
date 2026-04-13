'use client'

import { useRef, useEffect } from 'react'
import type { GameEvent } from '@/types/game'
import { POWER_DEFINITIONS } from '@/lib/gameConstants.server'

interface BattleLogProps {
  events: GameEvent[]
  localPlayerId: string
}

interface FormattedLogEntry {
  id: string
  text: string
  color: string
}

function formatEvent(event: GameEvent, localPlayerId: string): FormattedLogEntry {
  const isLocal = event.attackerId === localPlayerId
  const powerDef = event.power ? POWER_DEFINITIONS[event.power] : null
  const powerName = powerDef?.name ?? 'Unknown'

  let text = ''
  let color = ''

  switch (event.type) {
    case 'attack': {
      const effectStr = event.damage ? `-${event.damage} HP` : powerDef?.effect ?? 'hit'
      text = `${isLocal ? 'You' : 'Opponent'} used ${powerName} → ${effectStr}`
      color = isLocal ? '#3b82f6' : '#f97316'
      break
    }
    case 'defend': {
      text = `${isLocal ? 'You' : 'Opponent'} blocked with ${powerName}`
      color = '#06b6d4'
      break
    }
    case 'heal': {
      const healStr = event.healAmount ? `+${event.healAmount} HP` : 'restored HP'
      text = `${isLocal ? 'You' : 'Opponent'} used ${powerName} → ${healStr}`
      color = '#22c55e'
      break
    }
    case 'status_apply': {
      const statusStr = event.status ?? 'status'
      text = `${isLocal ? 'You' : 'Opponent'} applied ${statusStr} via ${powerName}`
      color = isLocal ? '#3b82f6' : '#f97316'
      break
    }
    case 'status_expire': {
      const statusStr = event.status ?? 'status'
      text = `${isLocal ? 'Your' : "Opponent's"} ${statusStr} wore off`
      color = '#94a3b8'
      break
    }
    case 'game_end': {
      const winnerIsLocal = event.attackerId === localPlayerId
      text = winnerIsLocal ? 'Victory! You won the battle.' : 'Defeat. Opponent won the battle.'
      color = winnerIsLocal ? '#eab308' : '#94a3b8'
      break
    }
    default: {
      text = `${isLocal ? 'You' : 'Opponent'} acted`
      color = '#94a3b8'
    }
  }

  return {
    id: `${event.sequenceNumber}-${event.type}`,
    text,
    color,
  }
}

export function BattleLog({ events, localPlayerId }: BattleLogProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef<number>(0)

  const formatted: FormattedLogEntry[] = events
    .map((e) => formatEvent(e, localPlayerId))
    .reverse()

  const visible = formatted.slice(0, 3)
  const overflow = formatted.slice(3)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    if (events.length > prevLengthRef.current) {
      el.style.transform = 'translateY(-8px)'
      el.style.opacity = '0.6'
      requestAnimationFrame(() => {
        el.style.transition = 'transform 200ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease'
        el.style.transform = 'translateY(0)'
        el.style.opacity = '1'
      })
    }
    prevLengthRef.current = events.length
  }, [events.length])

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        height: '48px',
        backgroundColor: '#0d1117',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
      }}
    >
      <div ref={contentRef} style={{ willChange: 'transform, opacity' }}>
        {visible.map((entry, idx) => (
          <div
            key={entry.id}
            style={{
              height: '16px',
              lineHeight: '16px',
              padding: '0 12px',
              fontSize: '11px',
              fontWeight: idx === 0 ? 700 : 400,
              color: idx === 0 ? entry.color : `${entry.color}99`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'opacity 300ms ease',
            }}
          >
            {entry.text}
          </div>
        ))}
        {overflow.map((entry) => (
          <div
            key={entry.id}
            style={{
              height: '16px',
              lineHeight: '16px',
              padding: '0 12px',
              fontSize: '11px',
              color: `${entry.color}33`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: 0,
              transition: 'opacity 300ms ease',
            }}
          >
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  )
}