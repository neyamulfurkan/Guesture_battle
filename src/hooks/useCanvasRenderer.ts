'use client'

import { RefObject, useEffect, useRef, useState } from 'react'

import {
  ATTACK_FLOAT_TEXT_DURATION,
  CANVAS_FRAME_TIME_CRITICAL,
  CANVAS_FRAME_TIME_WARN,
  CANVAS_PERFORMANCE_SAMPLE_FRAMES,
  CANVAS_TARGET_FPS,
  SHAKE_AMPLITUDE_PX,
  SHAKE_CYCLES_CRITICAL,
  SHAKE_CYCLES_NORMAL,
} from '@/lib/gameConstants'
import {
  drawCrackOverlay,
  drawDragonBlast,
  drawDragonImpact,
  drawFireball,
  drawFireballImpact,
  drawFloatingText,
  drawForceShockwave,
  drawGestureActivationOnHand,
  drawIceFreezeOverlay,
  drawReflectDome,
  drawScreenShake,
  drawShieldDome,
  drawThunderBolt,
  drawZapImpact,
  drawZapShot,
} from '@/services/canvasAnimations'
import { ParticleSystem } from '@/services/particleSystem'
import type { AnimationState, PlayerSide } from '@/types/game'
import { clamp } from '@/lib/utils'

export function useCanvasRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  animationState: AnimationState,
  tileRect: DOMRect | null,
  playerSide: PlayerSide
): { frameRate: number } {
  const animFrameRef = useRef<number>(0)
  const particleSystemRef = useRef<ParticleSystem>(new ParticleSystem())
  const lastTimeRef = useRef<number>(0)
  const frameTimes = useRef<number[]>([])
  const performanceModeRef = useRef<'full' | 'reduced' | 'minimal'>('full')
  const disableFaceOverlaysRef = useRef<boolean>(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const shakeFrameRef = useRef<number>(0)

  const [frameRate, setFrameRate] = useState<number>(CANVAS_TARGET_FPS)

  // Stable ref to animationState to avoid stale closure in RAF
  const animStateRef = useRef<AnimationState>(animationState)
  useEffect(() => {
    animStateRef.current = animationState
  }, [animationState])

  // ─── Canvas sizing ──────────────────────────────────────────────────────────

  function scaleCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const displayWidth = canvas.offsetWidth
    const displayHeight = canvas.offsetHeight
    const targetW = Math.round(displayWidth * dpr)
    const targetH = Math.round(displayHeight * dpr)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
      ctx.scale(dpr, dpr)
    }
  }

  // ─── Performance tracking ───────────────────────────────────────────────────

  function recordFrameTime(ms: number): void {
    frameTimes.current.push(ms)
    if (frameTimes.current.length > CANVAS_PERFORMANCE_SAMPLE_FRAMES) {
      frameTimes.current.shift()
    }

    if (frameTimes.current.length < CANVAS_PERFORMANCE_SAMPLE_FRAMES) return

    const avg = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length

    if (avg > CANVAS_FRAME_TIME_CRITICAL) {
      performanceModeRef.current = 'minimal'
      disableFaceOverlaysRef.current = true
    } else if (avg > CANVAS_FRAME_TIME_WARN) {
      performanceModeRef.current = 'reduced'
      disableFaceOverlaysRef.current = false
    } else {
      performanceModeRef.current = 'full'
      disableFaceOverlaysRef.current = false
    }

    const newFrameRate = avg > 0 ? Math.round(1000 / avg) : CANVAS_TARGET_FPS
    setFrameRate(newFrameRate)
  }

  // ─── RAF render loop ────────────────────────────────────────────────────────

  function renderFrame(now: number): void {
    const canvas = canvasRef.current
    if (!canvas) {
      animFrameRef.current = requestAnimationFrame(renderFrame)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(renderFrame)
      return
    }

    const deltaTime = lastTimeRef.current > 0 ? now - lastTimeRef.current : 16
    lastTimeRef.current = now
    recordFrameTime(deltaTime)

const dpr = window.devicePixelRatio || 1
    const displayWidth = canvas.offsetWidth
    const displayHeight = canvas.offsetHeight

    // Clear frame — use logical (CSS) pixel dimensions, not physical
    ctx.clearRect(0, 0, displayWidth, displayHeight)

    const state = animStateRef.current
    const perf = performanceModeRef.current

    // Update particle system
    particleSystemRef.current.update(deltaTime)

    // ── Shake ───────────────────────────────────────────────────────────────
    const shakeAmp = state.shakeAmplitude[playerSide] ?? 0
    if (shakeAmp > 0) {
      shakeFrameRef.current++
      const maxCycles = perf === 'reduced' ? SHAKE_CYCLES_NORMAL : SHAKE_CYCLES_CRITICAL
      if (shakeFrameRef.current > maxCycles * 2) {
        shakeFrameRef.current = 0
      }
      ctx.save()
      const dx = (Math.random() - 0.5) * 2 * clamp(shakeAmp, 0, SHAKE_AMPLITUDE_PX)
      const dy = (Math.random() - 0.5) * 2 * clamp(shakeAmp, 0, SHAKE_AMPLITUDE_PX)
      ctx.translate(dx, dy)
    }

    // ── Attack projectiles ──────────────────────────────────────────────────
    for (const projectile of state.activeProjectiles) {
      switch (projectile.type) {
        case 'fire_punch':
          drawFireball(ctx, projectile, displayWidth, displayHeight, now)
          if (perf !== 'minimal') {
            particleSystemRef.current.emit('fire', displayWidth * 0.5, displayHeight * 0.5, 2)
          }
          break
        case 'zap_shot':
          drawZapShot(ctx, projectile, displayWidth, displayHeight, now)
          if (perf !== 'minimal') {
            particleSystemRef.current.emit('lightning', displayWidth * 0.5, displayHeight * 0.5, 1)
          }
          break
        case 'dragon_blast':
          drawDragonBlast(ctx, projectile, displayWidth, displayHeight, now)
          if (perf === 'full') {
            particleSystemRef.current.emit('fire', displayWidth * 0.5, displayHeight * 0.5, 3)
            particleSystemRef.current.emit('spark', displayWidth * 0.5, displayHeight * 0.5, 2)
          }
          break
        case 'force_push':
          drawForceShockwave(ctx, displayWidth, displayHeight, now, projectile.startTime)
          break
        default:
          break
      }
    }

    // ── Impacts ─────────────────────────────────────────────────────────────
    for (const impact of state.activeImpacts) {
      if (impact.side !== playerSide) continue
      switch (impact.type) {
        case 'fire_punch':
          drawFireballImpact(ctx, impact, displayWidth, displayHeight, now)
          if (perf !== 'minimal') {
            particleSystemRef.current.emit('fire', displayWidth * 0.5, displayHeight * 0.4, 4)
            particleSystemRef.current.emit('spark', displayWidth * 0.5, displayHeight * 0.4, 3)
          }
          break
        case 'zap_shot':
        case 'thunder_smash':
          drawZapImpact(ctx, impact, displayWidth, displayHeight, now)
          if (perf !== 'minimal') {
            particleSystemRef.current.emit('lightning', displayWidth * 0.5, displayHeight * 0.4, 3)
          }
          break
        case 'dragon_blast':
          drawDragonImpact(ctx, impact, displayWidth, displayHeight, now)
          if (perf === 'full') {
            particleSystemRef.current.emit('fire', displayWidth * 0.5, displayHeight * 0.4, 6)
            particleSystemRef.current.emit('spark', displayWidth * 0.5, displayHeight * 0.4, 4)
          }
          break
        case 'heal':
        case 'full_restore':
          if (perf !== 'minimal') {
            particleSystemRef.current.emit('healing', displayWidth * 0.5, displayHeight * 0.5, 5)
          }
          break
        default:
          break
      }
    }

    // ── Status overlays (persistent, driven by tileFilters & activeImpacts) ──
    const tileFilter = state.tileFilters[playerSide]

    // Ice freeze — hueRotate set when 'frozen' status is active
    if (tileFilter && tileFilter.hueRotate > 0) {
      drawIceFreezeOverlay(ctx, displayWidth, displayHeight, true, now)
    }

    // Reflect dome — saturate > 1 signals 'reflect' status active
    const hasDome = tileFilter?.saturate > 1
    if (hasDome) {
      drawReflectDome(ctx, displayWidth, displayHeight, now)
    }

    // Shield dome — drawn whenever a 'shield' impact is in the active impacts list for this side
    // OR whenever we have an active shield status (checked via a persistent shield impact)
    const hasActiveShield = state.activeImpacts.some(
      (imp) => imp.type === 'shield' && imp.side === playerSide
    )
    if (hasActiveShield) {
      const centerRegion = new DOMRect(
        displayWidth * 0.15,
        displayHeight * 0.1,
        displayWidth * 0.7,
        displayHeight * 0.75
      )
      drawShieldDome(ctx, centerRegion, true, false, now)
    }

    // Burning overlay — contrast > 1 signals 'burning' status active
    if (tileFilter && tileFilter.contrast > 1.1) {
      // Draw animated fire tint over the tile
      ctx.save()
      const burnPulse = 0.08 + Math.sin(now * 0.006) * 0.04
      ctx.fillStyle = `rgba(249,115,22,${burnPulse})`
      ctx.fillRect(0, 0, displayWidth, displayHeight)
      // Animated fire border
      const borderGlow = Math.abs(Math.sin(now * 0.005)) * 0.7 + 0.3
      ctx.strokeStyle = `rgba(249,115,22,${borderGlow})`
      ctx.lineWidth = 4
      ctx.shadowColor = '#f97316'
      ctx.shadowBlur = 18
      ctx.strokeRect(2, 2, displayWidth - 4, displayHeight - 4)
      ctx.restore()
    }

    // Healing glow — draw when heal impact is active on this side
    const hasHealImpact = state.activeImpacts.some(
      (imp) => (imp.type === 'heal' || imp.type === 'full_restore') && imp.side === playerSide
    )
    if (hasHealImpact) {
      ctx.save()
      const healT = Date.now() % 1200 / 1200
      const healPulse = Math.sin(healT * Math.PI) * 0.12
      ctx.fillStyle = `rgba(34,197,94,${healPulse})`
      ctx.fillRect(0, 0, displayWidth, displayHeight)
      ctx.strokeStyle = `rgba(34,197,94,${0.4 + healPulse * 2})`
      ctx.lineWidth = 3
      ctx.shadowColor = '#22c55e'
      ctx.shadowBlur = 20
      ctx.strokeRect(2, 2, displayWidth - 4, displayHeight - 4)
      ctx.restore()
      // Healing particles rising
      if (perf !== 'minimal') {
        particleSystemRef.current.emit('healing', displayWidth * 0.3 + Math.random() * displayWidth * 0.4, displayHeight * 0.8, 2)
      }
    }

    // Thunder bolt — drawn on target tile for thunder_smash impacts
    const hasThunder = state.activeImpacts.some(
      (imp) => imp.type === 'thunder_smash' && imp.side === playerSide
    )
    if (hasThunder) {
      drawThunderBolt(ctx, displayWidth, displayHeight, now)
    }

    // Stun/frozen sparkle overlay
    const hasIceFreezeImpact = state.activeImpacts.some(
      (imp) => imp.type === 'ice_freeze' && imp.side === playerSide
    )
    if (hasIceFreezeImpact || (tileFilter && tileFilter.hueRotate > 0)) {
      if (perf !== 'minimal') {
        particleSystemRef.current.emit('lightning', Math.random() * displayWidth, Math.random() * displayHeight, 1)
      }
    }

    // War cry aura — sepia signals war_cry status
    if (tileFilter && tileFilter.sepia > 0) {
      ctx.save()
      const warPulse = 0.06 + Math.abs(Math.sin(now * 0.008)) * 0.06
      ctx.fillStyle = `rgba(249,115,22,${warPulse})`
      ctx.fillRect(0, 0, displayWidth, displayHeight)
      ctx.strokeStyle = `rgba(234,179,8,${0.5 + warPulse * 3})`
      ctx.lineWidth = 3
      ctx.shadowColor = '#eab308'
      ctx.shadowBlur = 16
      ctx.strokeRect(2, 2, displayWidth - 4, displayHeight - 4)
      ctx.restore()
    }

    // ── Crack overlay (critical HP) ──────────────────────────────────────────
    if (tileFilter && tileFilter.contrast > 1 && tileFilter.contrast <= 1.1) {
      const intensity = clamp((tileFilter.contrast - 1) / 0.1, 0, 1)
      drawCrackOverlay(ctx, displayWidth, displayHeight, intensity)
    }

    // ── Particles render ────────────────────────────────────────────────────
    particleSystemRef.current.render(ctx)

    // ── Floating texts ──────────────────────────────────────────────────────
    const now2 = now
    for (const ft of state.floatingTexts) {
      if (ft.side !== playerSide) continue
      const elapsed = now2 - ft.startTime
      if (elapsed >= ATTACK_FLOAT_TEXT_DURATION) continue
      drawFloatingText(ctx, ft, now2)
    }

    // ── Gesture activation on hand ──────────────────────────────────────────
    const activation = state.activeGestureActivation
    if (activation && activation.side === playerSide) {
      // palmX/palmY are normalized 0-1 — convert to canvas pixel coords
      // For remote tile, center the overlay (0.5, 0.5) since we have no hand landmarks
      const pixelPalmX = activation.palmX * displayWidth
      const pixelPalmY = activation.palmY * displayHeight
      drawGestureActivationOnHand(
        ctx,
        pixelPalmX,
        pixelPalmY,
        activation.powerId,
        activation.gestureId,
        activation.startTime,
        now
      )
    }

    // Restore shake transform
    if (shakeAmp > 0) {
      ctx.restore()
    }

    animFrameRef.current = requestAnimationFrame(renderFrame)
  }

  // ─── Mount / unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Initial scale
    scaleCanvas(canvas)

    // Observe resize
    const observer = new ResizeObserver(() => {
      scaleCanvas(canvas)
    })
    observer.observe(canvas)
    resizeObserverRef.current = observer

    // Start render loop
    lastTimeRef.current = 0
    animFrameRef.current = requestAnimationFrame(renderFrame)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      observer.disconnect()
      particleSystemRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef])

  return { frameRate }
}