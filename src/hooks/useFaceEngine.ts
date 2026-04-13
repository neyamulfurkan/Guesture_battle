'use client'

import { useRef, useEffect, useState, type RefObject } from 'react'
import { FaceEngine } from '@/services/faceService'
import type { FaceExpression } from '@/types/game'

export function useFaceEngine(
  videoRef: RefObject<HTMLVideoElement>,
  onExpression: (expression: FaceExpression) => void,
  enabled: boolean
): { isDetecting: boolean; lastExpression: FaceExpression | null } {
  const engineRef = useRef<FaceEngine | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [lastExpression, setLastExpression] = useState<FaceExpression | null>(null)
  const onExpressionRef = useRef(onExpression)

  useEffect(() => {
    onExpressionRef.current = onExpression
  }, [onExpression])

  useEffect(() => {
    if (!enabled) {
      if (engineRef.current) {
        engineRef.current.stop()
        setIsDetecting(false)
      }
      return
    }

    const video = videoRef.current
    if (!video) return

    let cancelled = false

    const initialize = async () => {
      if (!engineRef.current) {
        engineRef.current = new FaceEngine()
      }

      try {
        await engineRef.current.init(video, (expression: FaceExpression) => {
          if (cancelled) return
          setLastExpression(expression)
          onExpressionRef.current(expression)
        })

        if (cancelled) return

        engineRef.current.start()
        setIsDetecting(true)
      } catch {
        setIsDetecting(false)
      }
    }

    initialize()

    return () => {
      cancelled = true
      if (engineRef.current) {
        engineRef.current.stop()
        setIsDetecting(false)
      }
    }
  }, [enabled, videoRef])

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.cleanup()
        engineRef.current = null
      }
    }
  }, [])

  return { isDetecting, lastExpression }
}