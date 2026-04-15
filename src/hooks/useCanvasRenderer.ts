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
      switch (impact.type) {
        case 'fire_punch':
          drawFireballImpact(ctx, impact, displayWidth, now)
          if (perf !== 'minimal') {
            particleSystemRef.current.emit('fire', displayWidth * 0.5, displayHeight * 0.4, 4)
            particleSystemRef.current.emit('spark', displayWidth * 0.5, displayHeight * 0.4, 3)
          }
          break
        case 'zap_shot':
        case 'thunder_smash':
          drawZapImpact(ctx, impact, displayWidth, now)
          if (perf !== 'minimal') {
            particleSystemRef.current.emit('lightning', displayWidth * 0.5, displayHeight * 0.4, 3)
          }
          break
        case 'dragon_blast':
          drawDragonImpact(ctx, impact, displayWidth, now)
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

    // ── Status overlays ─────────────────────────────────────────────────────
    if (!disableFaceOverlaysRef.current) {
      const tileFilter = state.tileFilters[playerSide]

      if (tileFilter) {
        // Ice freeze overlay when frozen
        if (tileFilter.hueRotate > 0) {
          drawIceFreezeOverlay(ctx, displayWidth, displayHeight, true, now)
        }
      }
    }

    // Reflect dome if active — check via tile filter saturate as proxy
    const hasDome = state.tileFilters[playerSide]?.saturate > 1
    if (hasDome) {
      drawReflectDome(ctx, displayWidth, displayHeight, now)
    }

    // Thunder bolt — drawn on target tile for thunder_smash impacts
    const hasThunder = state.activeImpacts.some(
      (imp) => imp.type === 'thunder_smash' && imp.side === playerSide
    )
    if (hasThunder) {
      drawThunderBolt(ctx, displayWidth, displayHeight, now)
    }

    // ── Crack overlay (low HP) ───────────────────────────────────────────────
    const filter = state.tileFilters[playerSide]
    if (filter && filter.contrast > 1) {
      const intensity = clamp((filter.contrast - 1) / 0.5, 0, 1)
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