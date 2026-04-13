'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { ProgressRing } from '@/components/ui/ProgressRing'
import {
  COMBO_WINDOW_MS,
} from '@/lib/gameConstants'
import type { ComboState, VoiceKeyword, GestureId, PowerId } from '@/types/game'

// ─── GESTURE ICON MAP ────────────────────────────────────────────────────────

const GESTURE_SYMBOLS: Record<GestureId, string> = {
  fist: '✊',
  open_palm: '🖐',
  index_point: '☝️',
  peace_sign: '✌️',
  shaka: '🤙',
  thumbs_up: '👍',
  thumbs_down: '👎',
  flat_palm: '🤚',
  crossed_fingers: '🤞',
  wrist_spin: '🔄',
  both_hands_push: '🫸',
  both_hands_open: '🙌',
  swipe_left: '👈',
  swipe_right: '👉',
}

const POWER_TIER_COLOR: Record<PowerId, string> = {
  fire_punch: '#94a3b8',
  shield: '#94a3b8',
  zap_shot: '#94a3b8',
  heal: '#94a3b8',
  ice_freeze: '#3b82f6',
  double_strike: '#3b82f6',
  thunder_smash: '#3b82f6',
  force_push: '#3b82f6',
  dragon_blast: '#a855f7',
  reflect_dome: '#a855f7',
  full_restore: '#a855f7',
}

// ─── PROPS ───────────────────────────────────────────────────────────────────

interface ComboBarProps {
  comboState: ComboState
  lastVoiceKeyword: VoiceKeyword | null
  voiceLevel: number
  isVoiceListening: boolean
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function ComboBar({
  comboState,
  lastVoiceKeyword,
  voiceLevel,
  isVoiceListening,
}: ComboBarProps) {
  const BAR_COUNT = 12

  // Voice keyword flash state
  const [keywordFlash, setKeywordFlash] = useState(false)
  const [visibleKeyword, setVisibleKeyword] = useState<VoiceKeyword | null>(null)
  const keywordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keywordTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Combo icon flash state
  const [comboFlash, setComboFlash] = useState(false)
  const [comboFail, setComboFail] = useState(false)
  const prevComboRef = useRef<GestureId[]>([])
  const prevTargetRef = useRef<PowerId | null>(null)

  // Countdown ring state
  const [ringProgress, setRingProgress] = useState(0)
  const rafRef = useRef<number | null>(null)

  // ── Voice keyword effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!lastVoiceKeyword) return

    setKeywordFlash(true)
    setVisibleKeyword(lastVoiceKeyword)

    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current)
    if (keywordTextTimerRef.current) clearTimeout(keywordTextTimerRef.current)

    keywordTimerRef.current = setTimeout(() => {
      setKeywordFlash(false)
    }, 500)

    keywordTextTimerRef.current = setTimeout(() => {
      setVisibleKeyword(null)
    }, 700)

    return () => {
      if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current)
      if (keywordTextTimerRef.current) clearTimeout(keywordTextTimerRef.current)
    }
  }, [lastVoiceKeyword])

  // ── Combo state change effect ─────────────────────────────────────────────
  useEffect(() => {
    const prev = prevComboRef.current
    const prevTarget = prevTargetRef.current
    const curr = comboState.sequence

    // Detect combo completion: had a target, now sequence reset & no target
    if (prevTarget && !comboState.target && curr.length === 0 && prev.length > 0) {
      setComboFlash(true)
      const t = setTimeout(() => setComboFlash(false), 600)
      return () => clearTimeout(t)
    }

    // Detect combo fail: had sequence, window expired (windowExpiresAt null) with no completion
    if (prev.length > 0 && curr.length === 0 && !comboState.target && !prevTarget) {
      setComboFail(true)
      const t = setTimeout(() => setComboFail(false), 400)
      return () => clearTimeout(t)
    }

    prevComboRef.current = curr
    prevTargetRef.current = comboState.target
  }, [comboState])

  // ── Ring countdown RAF loop ───────────────────────────────────────────────
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (!comboState.windowExpiresAt) {
      setRingProgress(0)
      return
    }

    const tick = () => {
      const now = Date.now()
      const remaining = comboState.windowExpiresAt! - now
      const progress = Math.min(1, Math.max(0, remaining / COMBO_WINDOW_MS))
      setRingProgress(progress)
      if (progress > 0) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [comboState.windowExpiresAt])

  // ── Bar heights ───────────────────────────────────────────────────────────
  const getBarHeight = (index: number): number => {
    const base = 4
    const max = 24
    // Distribute voice level across bars with center bias
    const center = BAR_COUNT / 2
    const distFromCenter = Math.abs(index - center) / center
    const envelope = 1 - distFromCenter * 0.4
    const noise = Math.sin(Date.now() / 80 + index * 0.9) * 0.15 + 0.85
    const height = base + (max - base) * voiceLevel * envelope * noise
    return Math.round(height)
  }

  // Force re-render for bar animation when voice is active
  const [, tick] = useState(0)
  useEffect(() => {
    if (!isVoiceListening || voiceLevel === 0) return
    const id = setInterval(() => tick(n => n + 1), 50)
    return () => clearInterval(id)
  }, [isVoiceListening, voiceLevel])

  // ── Combo icon flash color ────────────────────────────────────────────────
  const flashColor =
    comboFlash && comboState.target
      ? POWER_TIER_COLOR[comboState.target]
      : undefined

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div
      className="flex items-center justify-between w-full px-3 select-none"
      style={{
        height: 32,
        background: '#0d1117',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* LEFT: Mic + Waveform + Keyword */}
      <div className="flex items-center gap-2" style={{ minWidth: 0, flex: '0 0 auto' }}>
        {isVoiceListening ? (
          <Mic
            size={14}
            style={{
              color: keywordFlash ? '#ffffff' : '#06b6d4',
              flexShrink: 0,
              transition: 'color 100ms',
            }}
          />
        ) : (
          <MicOff size={14} style={{ color: '#475569', flexShrink: 0 }} />
        )}

        {/* Waveform bars */}
        <div
          className="flex items-center"
          style={{ gap: 2, height: 24 }}
          aria-hidden="true"
        >
          {Array.from({ length: BAR_COUNT }).map((_, i) => {
            const h = isVoiceListening ? getBarHeight(i) : 4
            const isFlashing = keywordFlash
            return (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h,
                  borderRadius: 2,
                  background: isFlashing
                    ? '#06b6d4'
                    : isVoiceListening && voiceLevel > 0.05
                    ? `rgba(6,182,212,${0.4 + voiceLevel * 0.6})`
                    : 'rgba(255,255,255,0.12)',
                  transition: isFlashing
                    ? 'background 80ms'
                    : 'height 60ms ease-out, background 150ms',
                  flexShrink: 0,
                }}
              />
            )
          })}
        </div>

        {/* Keyword flash text */}
        {visibleKeyword && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#06b6d4',
              letterSpacing: '0.08em',
              animation: 'none',
              opacity: keywordFlash ? 1 : 0.6,
              transition: 'opacity 200ms',
              whiteSpace: 'nowrap',
            }}
          >
            {visibleKeyword}
          </span>
        )}
      </div>

      {/* RIGHT: Combo sequence tracker */}
      <div
        className="flex items-center gap-1"
        style={{ flex: '0 0 auto', maxWidth: '55%' }}
        aria-label="Combo sequence"
      >
        {comboState.sequence.length === 0 && !comboState.target ? null : (
          <>
            {/* Completed gesture icons */}
            {comboState.sequence.map((gesture, i) => (
              <span
                key={`${gesture}-${i}`}
                style={{
                  fontSize: 14,
                  lineHeight: 1,
                  opacity: comboFail ? 0.2 : 1,
                  color: comboFlash ? flashColor : undefined,
                  filter: comboFlash
                    ? `drop-shadow(0 0 4px ${flashColor})`
                    : undefined,
                  transition: comboFail
                    ? 'opacity 300ms ease-out'
                    : 'color 150ms, filter 150ms',
                }}
                title={gesture}
              >
                {GESTURE_SYMBOLS[gesture] ?? '?'}
              </span>
            ))}

            {/* Separator between completed and next */}
            {comboState.sequence.length > 0 && comboState.voiceRequired && (
              <span
                style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}
              >
                +
              </span>
            )}

            {/* Voice required badge */}
            {comboState.voiceRequired && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(6,182,212,0.5)',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                "{comboState.voiceRequired}"
              </span>
            )}

            {/* Countdown ring */}
            {comboState.windowExpiresAt && ringProgress > 0 && (
              <div style={{ marginLeft: 4, flexShrink: 0 }}>
                <ProgressRing
                  progress={ringProgress}
                  size={20}
                  strokeWidth={2}
                  color={ringProgress < 0.25 ? '#ef4444' : '#06b6d4'}
                  bgColor="rgba(255,255,255,0.08)"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}