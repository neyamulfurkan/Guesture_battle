// src/hooks/useGestureEngine.ts
'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  MEDIAPIPE_SLOW_DEVICE_FRAMES,
  MEDIAPIPE_SLOW_DEVICE_TOTAL_MS,
  BRIGHTNESS_LOW_THRESHOLD,
  BRIGHTNESS_CHECK_INTERVAL_MS,
  BRIGHTNESS_TOAST_COOLDOWN_MS,
} from '@/lib/gameConstants'
import type { HandsResults } from '@/types/mediapipe.d'
import type { GestureId } from '@/types/game'
import { GestureEngine } from '@/services/gestureService'
import { calculateLuminance } from '@/lib/utils'

// Minimal Zustand-compatible store interface for slow device flag
// We use a module-level flag to avoid circular imports with a full store
let _isSlowDevice = false
let _slowDeviceListeners: Array<(val: boolean) => void> = []

function setSlowDevice(val: boolean): void {
  _isSlowDevice = val
  for (const l of _slowDeviceListeners) l(val)
}

function useSlowDeviceFlag(): boolean {
  const [val, setVal] = useState(_isSlowDevice)
  useEffect(() => {
    const handler = (v: boolean) => setVal(v)
    _slowDeviceListeners.push(handler)
    return () => {
      _slowDeviceListeners = _slowDeviceListeners.filter((l) => l !== handler)
    }
  }, [])
  return val
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useGestureEngine(
  videoRef: React.RefObject<HTMLVideoElement>,
  onGesture: (gesture: GestureId) => void,
  enabled: boolean
): {
  isDetecting: boolean
  isHandDetected: boolean
  landmarkData: HandsResults | null
  lastConfirmedGesture: { gestureId: GestureId; palmX: number; palmY: number; time: number } | null
} {
  const engineRef = useRef<GestureEngine | null>(null)
  const onGestureRef = useRef(onGesture)
  const [isDetecting, setIsDetecting] = useState(false)
  const [isHandDetected, setIsHandDetected] = useState(false)
  const [landmarkData, setLandmarkData] = useState<HandsResults | null>(null)
  const [lastConfirmedGesture, setLastConfirmedGesture] = useState<{ gestureId: GestureId; palmX: number; palmY: number; time: number } | null>(null)

  // Performance tracking
  const landmarkDataRef = useRef<HandsResults | null>(null)
  const frameTimesRef = useRef<number[]>([])
  const lastFrameTimeRef = useRef<number>(0)
  const slowDeviceCheckedRef = useRef(false)

  // Brightness monitoring
  const brightnessIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastBrightnessToastRef = useRef<number>(0)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Keep onGesture ref current
  useEffect(() => {
    onGestureRef.current = onGesture
  }, [onGesture])

  // Wrapped gesture callback that intercepts results for state tracking
  const handleGesture = useCallback((gesture: GestureId) => {
    const results = landmarkDataRef.current
    if (results && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const lm = results.multiHandLandmarks[0]
      const video = videoRef.current
      const vw = video?.offsetWidth ?? video?.videoWidth ?? 640
      const vh = video?.offsetHeight ?? video?.videoHeight ?? 480
      const nativeW = video?.videoWidth ?? 640
      const nativeH = video?.videoHeight ?? 480

      // Compute cover-fit transform to map normalized coords to display coords
      const containerAspect = vw / vh
      const videoAspect = nativeW / nativeH
      let drawW: number, drawH: number
      if (videoAspect > containerAspect) {
        drawH = vh
        drawW = nativeW * (vh / nativeH)
      } else {
        drawW = vw
        drawH = nativeH * (vw / nativeW)
      }
      const offsetX = (vw - drawW) / 2
      const offsetY = (vh - drawH) / 2

      const palmLm = lm[9]
      if (palmLm) {
        const rawX = palmLm.x * nativeW * (drawW / nativeW) + offsetX
        const mappedX = video ? vw - rawX : rawX // mirror for local
        const mappedY = palmLm.y * nativeH * (drawH / nativeH) + offsetY
        setLastConfirmedGesture({
          gestureId: gesture,
          palmX: mappedX,
          palmY: mappedY,
          time: performance.now(),
        })
      }
    }
    onGestureRef.current(gesture)
  }, [])

  // Patch GestureEngine.onResults to intercept HandsResults for state tracking
  const patchEngineForTracking = useCallback((engine: GestureEngine) => {
    const originalOnResults = engine.onResults.bind(engine)

    engine.onResults = (results: HandsResults) => {
      const now = performance.now()

      // Track frame processing time for slow device detection
      if (!slowDeviceCheckedRef.current) {
        if (lastFrameTimeRef.current > 0) {
          const elapsed = now - lastFrameTimeRef.current
          frameTimesRef.current.push(elapsed)

          if (frameTimesRef.current.length >= MEDIAPIPE_SLOW_DEVICE_FRAMES) {
            const total = frameTimesRef.current.reduce((a, b) => a + b, 0)
            if (total > MEDIAPIPE_SLOW_DEVICE_TOTAL_MS) {
              setSlowDevice(true)
            }
            slowDeviceCheckedRef.current = true
          }
        }
        lastFrameTimeRef.current = now
      }

      // Update hand detection state
      const hasHands =
        results.multiHandLandmarks && results.multiHandLandmarks.length > 0
      setIsHandDetected(hasHands)
      setLandmarkData(results)
      landmarkDataRef.current = results

      originalOnResults(results)
    }
  }, [])

  // Brightness monitoring via offscreen canvas
  const startBrightnessMonitoring = useCallback(
    (video: HTMLVideoElement) => {
      if (brightnessIntervalRef.current !== null) return

      if (!offscreenCanvasRef.current) {
        const canvas = document.createElement('canvas')
        canvas.width = 10
        canvas.height = 10
        offscreenCanvasRef.current = canvas
      }

      brightnessIntervalRef.current = setInterval(() => {
        if (!video || video.readyState < 2) return

        const canvas = offscreenCanvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        try {
          ctx.drawImage(video, 0, 0, 10, 10)
          const imageData = ctx.getImageData(0, 0, 10, 10)
          const data = imageData.data

          let totalLuminance = 0
          const pixelCount = 10 * 10

          for (let i = 0; i < data.length; i += 4) {
            totalLuminance += calculateLuminance(data[i], data[i + 1], data[i + 2])
          }

          const avgLuminance = totalLuminance / pixelCount

          if (avgLuminance < BRIGHTNESS_LOW_THRESHOLD) {
            const now = Date.now()
            if (now - lastBrightnessToastRef.current > BRIGHTNESS_TOAST_COOLDOWN_MS) {
              lastBrightnessToastRef.current = now
              // Dispatch a custom event that the Toast system can listen for
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('gesturebattle:lowbrightness', {
                    detail: { luminance: avgLuminance },
                  })
                )
              }
            }
          }
        } catch {
          // Cross-origin or not-ready video — ignore silently
        }
      }, BRIGHTNESS_CHECK_INTERVAL_MS)
    },
    []
  )

  const stopBrightnessMonitoring = useCallback(() => {
    if (brightnessIntervalRef.current !== null) {
      clearInterval(brightnessIntervalRef.current)
      brightnessIntervalRef.current = null
    }
  }, [])

  // Main lifecycle effect — re-runs only when enabled toggles
  useEffect(() => {
    if (!enabled) {
      if (engineRef.current) {
        engineRef.current.stop()
        engineRef.current = null
      }
      stopBrightnessMonitoring()
      setIsDetecting(false)
      setIsHandDetected(false)
      setLandmarkData(null)
      return
    }

    const video = videoRef.current
    if (!video) return

    let cancelled = false

    const initEngine = async () => {
      const engine = new GestureEngine(handleGesture)
      engineRef.current = engine

      patchEngineForTracking(engine)

      try {
        await engine.init(video)

        if (cancelled) {
          engine.stop()
          return
        }

        engine.start()
        setIsDetecting(true)
        startBrightnessMonitoring(video)
      } catch (err) {
        if (!cancelled) {
          setIsDetecting(false)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('gesturebattle:engineerror', {
                detail: {
                  message:
                    err instanceof Error
                      ? err.message
                      : 'Gesture detection failed to start.',
                },
              })
            )
          }
        }
      }
    }

    initEngine()

    return () => {
      cancelled = true
      if (engineRef.current) {
        engineRef.current.stop()
        engineRef.current = null
      }
      stopBrightnessMonitoring()
      setIsDetecting(false)
      setIsHandDetected(false)
      setLandmarkData(null)
      landmarkDataRef.current = null
      setLastConfirmedGesture(null)
      frameTimesRef.current = []
      lastFrameTimeRef.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return {
    isDetecting,
    isHandDetected,
    landmarkData,
    lastConfirmedGesture,
  }
}