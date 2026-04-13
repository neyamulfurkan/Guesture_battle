'use client'

import { useEffect, useRef, useState } from 'react'
import type { PowerId, PowerTier } from '@/types/game'
import { POWER_DEFINITIONS } from '@/lib/gameConstants.server'

interface PowerUnlockCardProps {
  unlockedPowerId: PowerId | null
}

const TIER_COLORS: Record<PowerTier, string> = {
  1: '#94a3b8',
  2: '#3b82f6',
  3: '#a855f7',
}

const GESTURE_ICONS: Record<string, string> = {
  fist: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="28" width="32" height="22" rx="6" fill="currentColor" opacity="0.9"/>
    <rect x="18" y="16" width="8" height="16" rx="4" fill="currentColor"/>
    <rect x="28" y="14" width="8" height="18" rx="4" fill="currentColor"/>
    <rect x="38" y="16" width="8" height="16" rx="4" fill="currentColor"/>
    <rect x="12" y="30" width="8" height="14" rx="4" fill="currentColor"/>
  </svg>`,
  open_palm: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="28" width="6" height="22" rx="3" fill="currentColor"/>
    <rect x="22" y="18" width="6" height="32" rx="3" fill="currentColor"/>
    <rect x="30" y="14" width="6" height="36" rx="3" fill="currentColor"/>
    <rect x="38" y="18" width="6" height="32" rx="3" fill="currentColor"/>
    <rect x="46" y="24" width="6" height="26" rx="3" fill="currentColor"/>
    <rect x="14" y="46" width="38" height="8" rx="4" fill="currentColor" opacity="0.6"/>
  </svg>`,
  index_point: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="28" y="10" width="8" height="30" rx="4" fill="currentColor"/>
    <rect x="16" y="32" width="8" height="16" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="26" y="36" width="8" height="14" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="36" y="34" width="8" height="14" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="14" y="44" width="36" height="10" rx="5" fill="currentColor" opacity="0.7"/>
  </svg>`,
  shaka: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="28" width="8" height="18" rx="4" fill="currentColor"/>
    <rect x="46" y="18" width="8" height="18" rx="4" fill="currentColor"/>
    <rect x="18" y="36" width="8" height="14" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="28" y="36" width="8" height="14" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="38" y="36" width="8" height="14" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="10" y="44" width="44" height="10" rx="5" fill="currentColor" opacity="0.7"/>
  </svg>`,
  peace_sign: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="10" width="8" height="32" rx="4" fill="currentColor"/>
    <rect x="34" y="10" width="8" height="32" rx="4" fill="currentColor"/>
    <rect x="16" y="34" width="8" height="16" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="40" y="34" width="8" height="16" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="16" y="46" width="32" height="8" rx="4" fill="currentColor" opacity="0.7"/>
  </svg>`,
  crossed_fingers: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="26" y="10" width="8" height="28" rx="4" fill="currentColor" transform="rotate(-10 30 24)"/>
    <rect x="30" y="10" width="8" height="28" rx="4" fill="currentColor" transform="rotate(10 34 24)"/>
    <rect x="16" y="36" width="8" height="16" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="40" y="36" width="8" height="16" rx="4" fill="currentColor" opacity="0.5"/>
    <rect x="14" y="46" width="36" height="8" rx="4" fill="currentColor" opacity="0.7"/>
  </svg>`,
  both_hands_push: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="20" width="6" height="20" rx="3" fill="currentColor"/>
    <rect x="8" y="14" width="6" height="26" rx="3" fill="currentColor"/>
    <rect x="14" y="18" width="6" height="22" rx="3" fill="currentColor"/>
    <rect x="20" y="20" width="6" height="18" rx="3" fill="currentColor"/>
    <rect x="4" y="36" width="22" height="8" rx="4" fill="currentColor" opacity="0.7"/>
    <rect x="54" y="20" width="6" height="20" rx="3" fill="currentColor"/>
    <rect x="50" y="14" width="6" height="26" rx="3" fill="currentColor"/>
    <rect x="44" y="18" width="6" height="22" rx="3" fill="currentColor"/>
    <rect x="38" y="20" width="6" height="18" rx="3" fill="currentColor"/>
    <rect x="38" y="36" width="22" height="8" rx="4" fill="currentColor" opacity="0.7"/>
  </svg>`,
  wrist_spin: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="18" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="8 4"/>
    <rect x="28" y="14" width="8" height="20" rx="4" fill="currentColor"/>
    <rect x="22" y="42" width="20" height="8" rx="4" fill="currentColor" opacity="0.7"/>
    <path d="M44 20 L50 14 L50 26 Z" fill="currentColor"/>
  </svg>`,
  both_hands_open: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="16" width="5" height="18" rx="2.5" fill="currentColor"/>
    <rect x="8" y="10" width="5" height="24" rx="2.5" fill="currentColor"/>
    <rect x="14" y="14" width="5" height="20" rx="2.5" fill="currentColor"/>
    <rect x="20" y="16" width="5" height="16" rx="2.5" fill="currentColor"/>
    <rect x="2" y="30" width="23" height="8" rx="4" fill="currentColor" opacity="0.6"/>
    <rect x="57" y="16" width="5" height="18" rx="2.5" fill="currentColor"/>
    <rect x="51" y="10" width="5" height="24" rx="2.5" fill="currentColor"/>
    <rect x="45" y="14" width="5" height="20" rx="2.5" fill="currentColor"/>
    <rect x="39" y="16" width="5" height="16" rx="2.5" fill="currentColor"/>
    <rect x="39" y="30" width="23" height="8" rx="4" fill="currentColor" opacity="0.6"/>
  </svg>`,
}

function getGestureIcon(gestureId: string): string {
  return GESTURE_ICONS[gestureId] ?? GESTURE_ICONS['fist']
}

function getEffectText(powerId: PowerId): string {
  const def = POWER_DEFINITIONS[powerId]
  const parts: string[] = []
  if (def.damage) parts.push(`${def.damage} damage`)
  if (def.healAmount) parts.push(`+${def.healAmount} HP restored`)
  if (def.effect === 'stunned') parts.push('stuns opponent')
  if (def.effect === 'frozen') parts.push('freezes opponent')
  if (def.effect === 'reflect') parts.push('reflects 50% damage')
  if (def.effect === 'shield') parts.push('blocks incoming attacks')
  if (def.effect === 'healing') parts.push('restores health over time')
  if (def.voiceKeyword) parts.push(`say "${def.voiceKeyword}"`)
  return parts.join(' · ')
}

export function PowerUnlockCard({ unlockedPowerId }: PowerUnlockCardProps) {
  const [visible, setVisible] = useState(false)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (unlockedPowerId && !hasAnimated.current) {
      hasAnimated.current = true
      const raf = requestAnimationFrame(() => {
        setVisible(true)
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [unlockedPowerId])

  if (!unlockedPowerId) return null

  const def = POWER_DEFINITIONS[unlockedPowerId]
  const tierColor = TIER_COLORS[def.tier]
  const iconSvg = getGestureIcon(def.gestureId)
  const effectText = getEffectText(unlockedPowerId)

  return (
    <div
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: 'transform',
      }}
      className="w-full"
    >
      <div
        className="w-full rounded-2xl p-6 flex flex-col items-center gap-4"
        style={{
          background: '#0d1117',
          border: `2px solid #a855f7`,
          boxShadow: '0 0 20px rgba(168, 85, 247, 0.25), 0 0 60px rgba(168, 85, 247, 0.1)',
        }}
      >
        {/* Label */}
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: '#a855f7', letterSpacing: '0.2em' }}
        >
          New Power Unlocked!
        </p>

        {/* Gesture icon */}
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: 80,
            height: 80,
            background: '#1a2035',
            border: `2px solid ${tierColor}`,
            color: tierColor,
            animation: 'glow-pulse 600ms ease-in-out infinite',
            boxShadow: `0 0 12px ${tierColor}66, 0 0 28px ${tierColor}33`,
            flexShrink: 0,
          }}
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />

        {/* Power name */}
        <p
          className="font-bold"
          style={{ fontSize: 18, color: tierColor, lineHeight: 1.2, textAlign: 'center' }}
        >
          {def.name}
        </p>

        {/* Gesture description */}
        <p
          className="text-center"
          style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, maxWidth: 320 }}
        >
          {def.description}
        </p>

        {/* Effect text */}
        {effectText && (
          <p
            className="text-center font-bold"
            style={{ fontSize: 13, color: tierColor, opacity: 0.9 }}
          >
            {effectText}
          </p>
        )}

        {/* Tier badge */}
        <div
          className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{
            background: `${tierColor}22`,
            border: `1px solid ${tierColor}`,
            color: tierColor,
            fontSize: 11,
          }}
        >
          Tier {def.tier} Power
        </div>
      </div>
    </div>
  )
}