'use client'

import { useEffect, useRef, useCallback } from 'react'
import { BackgroundParticleSystem } from '@/services/particleSystem'

export default function BackgroundParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const systemRef = useRef<BackgroundParticleSystem>(new BackgroundParticleSystem())
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const startLoop = useCallback((ctx: CanvasRenderingContext2D) => {
    const loop = (timestamp: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp
      lastTimeRef.current = timestamp

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      systemRef.current.update()
      systemRef.current.render(ctx)

      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
  }, [])

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const isMobile = window.innerWidth < 640
    const dpr = window.devicePixelRatio || 1
    const w = window.innerWidth
    const h = window.innerHeight

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    systemRef.current.init(w, h, isMobile)

    return ctx
  }, [])

  useEffect(() => {
    const ctx = initCanvas()
    if (!ctx) return

    startLoop(ctx)

    const handleResize = () => {
      cancelAnimationFrame(animFrameRef.current)
      lastTimeRef.current = 0
      const newCtx = initCanvas()
      if (newCtx) startLoop(newCtx)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [initCanvas, startLoop])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  )
}