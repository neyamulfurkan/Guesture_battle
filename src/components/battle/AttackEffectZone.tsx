'use client'

import { useEffect, useRef } from 'react'
import {
  CANVAS_TARGET_FPS,
} from '@/lib/gameConstants'
import type { PlayerSide, Projectile } from '@/types/game'
import {
  drawFireball,
  drawZapShot,
  drawDragonBlast,
  drawForceShockwave,
} from '@/services/canvasAnimations'
import { ParticleSystem } from '@/services/particleSystem'

interface AttackEffectZoneProps {
  activeProjectiles: Projectile[]
  localSide: PlayerSide
}

export function AttackEffectZone({ activeProjectiles, localSide }: AttackEffectZoneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const particleSystemRef = useRef<ParticleSystem>(new ParticleSystem())
  const activeProjectilesRef = useRef<Projectile[]>(activeProjectiles)
  const forceShockwaveStartRef = useRef<number | null>(null)
  const prevProjectileIdsRef = useRef<Set<string>>(new Set())

  // Keep ref in sync so RAF closure always reads latest
  useEffect(() => {
    activeProjectilesRef.current = activeProjectiles

    // Detect new force_push projectiles to record their start time for shockwave
    const currentIds = new Set(activeProjectiles.map(p => p.id))
    for (const p of activeProjectiles) {
      if (!prevProjectileIdsRef.current.has(p.id) && p.type === 'force_push') {
        forceShockwaveStartRef.current = p.startTime
      }
    }
    prevProjectileIdsRef.current = currentIds
  }, [activeProjectiles])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const setCanvasDimensions = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
    }

    setCanvasDimensions()

    const resizeObserver = new ResizeObserver(() => {
      setCanvasDimensions()
    })
    resizeObserver.observe(canvas)

    let lastTime = performance.now()

    const renderFrame = (now: number) => {
      animFrameRef.current = requestAnimationFrame(renderFrame)

      const delta = now - lastTime
      lastTime = now

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr

      ctx.clearRect(0, 0, w, h)

      const projectiles = activeProjectilesRef.current

      particleSystemRef.current.update(delta)

      for (const projectile of projectiles) {
        switch (projectile.type) {
          case 'fire_punch':
            drawFireball(ctx, projectile, w, h, now)
            break
          case 'zap_shot':
            drawZapShot(ctx, projectile, w, h, now)
            break
          case 'dragon_blast':
            drawDragonBlast(ctx, projectile, w, h, now)
            break
          case 'force_push':
            if (forceShockwaveStartRef.current !== null) {
              drawForceShockwave(ctx, w, h, now, forceShockwaveStartRef.current)
            }
            break
          default:
            // Other projectile types not rendered in the strip
            break
        }
      }

      particleSystemRef.current.render(ctx)
    }

    animFrameRef.current = requestAnimationFrame(renderFrame)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      resizeObserver.disconnect()
      particleSystemRef.current.clear()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full game-canvas"
      style={{
        height: '80px',
        display: 'block',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    />
  )
}