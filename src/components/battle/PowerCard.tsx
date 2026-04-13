'use client'

import { Lock, Clock } from 'lucide-react'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { POWER_DEFINITIONS } from '@/lib/gameConstants.server'
import { formatCooldown } from '@/lib/utils'
import type { PowerId } from '@/types/game'

// ─── GESTURE ICONS ────────────────────────────────────────────────────────────

const GestureIcons: Record<string, () => JSX.Element> = {
  fist: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M6 9V7a2 2 0 0 1 2-2h.5a1.5 1.5 0 0 1 1.5 1.5V9" />
      <path d="M10 9V6.5A1.5 1.5 0 0 1 11.5 5h0A1.5 1.5 0 0 1 13 6.5V9" />
      <path d="M13 9V7.5A1.5 1.5 0 0 1 14.5 6h0A1.5 1.5 0 0 1 16 7.5V9" />
      <path d="M16 9.5V9a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 19 9v3a7 7 0 0 1-7 7H9a5 5 0 0 1-5-5v-2a2 2 0 0 1 2-2h.5" />
      <path d="M6 9h6" />
    </svg>
  ),
  open_palm: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M11 13V4.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M14 13V5.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M17 13v-2.5a1.5 1.5 0 0 1 3 0V17a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3a1.5 1.5 0 0 1 3 0V13" />
      <path d="M8 13H5" />
    </svg>
  ),
  index_point: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M10 8V4.5a1.5 1.5 0 0 1 3 0V8" />
      <path d="M13 8V9.5a1.5 1.5 0 0 1-3 0V8" />
      <path d="M10 8H7.5A1.5 1.5 0 0 0 6 9.5v0A1.5 1.5 0 0 0 7.5 11H10" />
      <path d="M13 8h3a2 2 0 0 1 2 2v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2a2 2 0 0 1 2-2h4" />
      <line x1="11.5" y1="4" x2="11.5" y2="2" />
    </svg>
  ),
  peace_sign: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M9 10V4.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M12 10V4.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M9 10H7.5A1.5 1.5 0 0 0 6 11.5v0A1.5 1.5 0 0 0 7.5 13H9" />
      <path d="M15 10h1a2 2 0 0 1 2 2v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-1a2 2 0 0 1 2-2h3" />
    </svg>
  ),
  shaka: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M6 6.5A1.5 1.5 0 0 1 7.5 5h0A1.5 1.5 0 0 1 9 6.5V10" />
      <path d="M18 17.5a1.5 1.5 0 0 1-1.5 1.5h0A1.5 1.5 0 0 1 15 17.5V14" />
      <path d="M9 11.5V11a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2.5" />
      <path d="M9 11.5A2.5 2.5 0 0 0 6.5 14v.5a5 5 0 0 0 5 5H12" />
      <path d="M15 13.5A2.5 2.5 0 0 1 17.5 11v-.5a5 5 0 0 0-5-5H12" />
    </svg>
  ),
  crossed_fingers: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M10 9V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M13 5.5a1.5 1.5 0 0 1 3 0V9" />
      <path d="M10 10l3-1" />
      <path d="M10 10v4a5 5 0 0 0 5 5h0a5 5 0 0 0 5-5v-4" />
      <path d="M7 12a2 2 0 0 0-2 2v1a5 5 0 0 0 5 5" />
    </svg>
  ),
  both_hands_push: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M4 9h2M18 9h2" />
      <path d="M6 7v4a5 5 0 0 0 5 5h2a5 5 0 0 0 5-5V7" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h0A1.5 1.5 0 0 1 12 5.5V7" />
      <path d="M12 7V5.5A1.5 1.5 0 0 1 13.5 4h0A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M9 7h6" />
    </svg>
  ),
  both_hands_open: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M3 10V8a1 1 0 0 1 1-1h1.5A1.5 1.5 0 0 1 7 8.5V10" />
      <path d="M7 10V8a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v2" />
      <path d="M3 10h7v3a4 4 0 0 1-4 4H6a3 3 0 0 1-3-3v-4" />
      <path d="M21 10V8a1 1 0 0 0-1-1h-1.5A1.5 1.5 0 0 0 17 8.5V10" />
      <path d="M17 10V8a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v2" />
      <path d="M21 10h-7v3a4 4 0 0 0 4 4h1a3 3 0 0 0 3-3v-4" />
    </svg>
  ),
  wrist_spin: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 8v4l3 3" />
      <path d="M18 3l3 3-3 3" />
    </svg>
  ),
}

const getFallbackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4l3 3" />
  </svg>
)

// ─── TIER COLORS ─────────────────────────────────────────────────────────────

const TIER_COLORS: Record<1 | 2 | 3, { border: string; text: string; glow: string; ringColor: string }> = {
  1: {
    border: '#94a3b8',
    text: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.4)',
    ringColor: '#94a3b8',
  },
  2: {
    border: '#3b82f6',
    text: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.4)',
    ringColor: '#3b82f6',
  },
  3: {
    border: '#a855f7',
    text: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.4)',
    ringColor: '#a855f7',
  },
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

interface PowerCardProps {
  powerId: PowerId
  isOnCooldown: boolean
  cooldownProgress: number
  isLocked: boolean
  isSelected: boolean
  onSelect?: () => void
}

export function PowerCard({
  powerId,
  isOnCooldown,
  cooldownProgress,
  isLocked,
  isSelected,
  onSelect,
}: PowerCardProps) {
  const power = POWER_DEFINITIONS[powerId]
  const tier = power.tier as 1 | 2 | 3
  const colors = TIER_COLORS[tier]
  const isReady = !isOnCooldown && !isLocked
  const cooldownRemainingMs = isOnCooldown
    ? power.cooldownMs * (1 - cooldownProgress)
    : 0

  const GestureIcon = GestureIcons[power.gestureId] ?? getFallbackIcon

  const statValue = power.damage
    ? `${power.damage} DMG`
    : power.healAmount
    ? `+${power.healAmount} HP`
    : null

  const borderStyle = isSelected
    ? {
        border: `2px solid ${colors.border}`,
        boxShadow: `0 0 12px 2px ${colors.glow}, 0 0 4px 1px ${colors.glow}`,
      }
    : isReady
    ? {
        border: `1px solid ${colors.border}`,
        boxShadow: `0 0 6px 1px ${colors.glow}`,
        animation: 'glow-pulse 2s ease-in-out infinite',
      }
    : {
        border: `1px solid rgba(148, 163, 184, 0.2)`,
        boxShadow: 'none',
      }

  return (
    <div className="relative" style={{ width: 80, height: 80 }}>
      {/* Tooltip */}
      {isSelected && (
        <div
          className="absolute z-20 bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ minWidth: 120 }}
        >
          <div
            className="rounded-lg px-2 py-1.5 text-center"
            style={{
              background: '#0d1117',
              border: `1px solid ${colors.border}`,
              boxShadow: `0 0 12px ${colors.glow}`,
            }}
          >
            <p className="text-white font-bold" style={{ fontSize: 11 }}>
              {power.name}
            </p>
            <p className="text-white/60" style={{ fontSize: 10 }}>
              {power.description}
            </p>
            {statValue && (
              <p className="font-bold mt-0.5" style={{ fontSize: 10, color: colors.text }}>
                {statValue}
              </p>
            )}
          </div>
          {/* Tooltip arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-full"
            style={{
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: `5px solid ${colors.border}`,
            }}
          />
        </div>
      )}

      {/* Card base */}
      <button
        onClick={onSelect}
        disabled={isLocked || isOnCooldown}
        aria-label={`${power.name}${isLocked ? ' (locked)' : isOnCooldown ? ' (on cooldown)' : ''}`}
        className="relative w-full h-full rounded-xl flex flex-col items-center justify-between overflow-hidden focus:outline-none"
        style={{
          background: '#1a2035',
          ...borderStyle,
          cursor: isLocked || isOnCooldown ? 'not-allowed' : 'pointer',
          padding: '6px 4px 4px',
          transition: 'border 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Gesture icon */}
        <div
          className="flex items-center justify-center"
          style={{ color: isLocked ? 'rgba(148,163,184,0.3)' : colors.text, flex: 1 }}
        >
          <GestureIcon />
        </div>

        {/* Power name */}
        <p
          className="font-bold text-center leading-tight truncate w-full px-0.5"
          style={{
            fontSize: 9,
            color: isLocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)',
            letterSpacing: '0.01em',
          }}
        >
          {power.name}
        </p>

        {/* Stat + cooldown row */}
        <div className="flex items-center justify-between w-full mt-0.5 px-0.5">
          {statValue ? (
            <span
              className="font-bold leading-none"
              style={{
                fontSize: 9,
                color: isLocked ? 'rgba(148,163,184,0.3)' : colors.text,
              }}
            >
              {statValue}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-0.5">
            <Clock
              style={{
                width: 8,
                height: 8,
                color: isLocked ? 'rgba(148,163,184,0.3)' : 'rgba(148,163,184,0.7)',
              }}
            />
            <span
              style={{
                fontSize: 8,
                color: isLocked ? 'rgba(148,163,184,0.3)' : 'rgba(148,163,184,0.7)',
                lineHeight: 1,
              }}
            >
              {formatCooldown(power.cooldownMs)}
            </span>
          </div>
        </div>

        {/* Cooldown overlay */}
        {isOnCooldown && !isLocked && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ background: 'rgba(5,8,16,0.75)' }}>
            <ProgressRing
              progress={cooldownProgress}
              size={44}
              strokeWidth={3}
              color={colors.ringColor}
              bgColor="rgba(148,163,184,0.15)"
            >
              <span
                className="font-bold tabular-nums"
                style={{ fontSize: 9, color: colors.text }}
              >
                {formatCooldown(cooldownRemainingMs)}
              </span>
            </ProgressRing>
          </div>
        )}

        {/* Locked overlay */}
        {isLocked && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(5,8,16,0.8)' }}
          >
            <Lock
              style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.5)' }}
            />
          </div>
        )}
      </button>
    </div>
  )
}