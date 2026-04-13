'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { SpeechEngine } from '@/services/speechService'
import type { VoiceKeyword } from '@/types/game'

export function useSpeechEngine(
  onKeyword: (keyword: VoiceKeyword) => void,
  enabled: boolean
): {
  isSupported: boolean
  isListening: boolean
  lastKeyword: VoiceKeyword | null
  muteDuring: (durationMs: number) => void
} {
  const engineRef = useRef<SpeechEngine | null>(null)
  const onKeywordRef = useRef(onKeyword)
  const [isSupported] = useState<boolean>(() => SpeechEngine.isSupported())
  const [isListening, setIsListening] = useState(false)
  const [lastKeyword, setLastKeyword] = useState<VoiceKeyword | null>(null)
  const lastKeywordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onKeywordRef.current = onKeyword
  }, [onKeyword])

  useEffect(() => {
    if (!isSupported) return

    const engine = new SpeechEngine()
    engineRef.current = engine

    engine.init((keyword: VoiceKeyword) => {
      onKeywordRef.current(keyword)
      setLastKeyword(keyword)
      if (lastKeywordTimerRef.current !== null) {
        clearTimeout(lastKeywordTimerRef.current)
      }
      lastKeywordTimerRef.current = setTimeout(() => {
        setLastKeyword(null)
        lastKeywordTimerRef.current = null
      }, 700)
    })

    return () => {
      if (lastKeywordTimerRef.current !== null) {
        clearTimeout(lastKeywordTimerRef.current)
      }
      engine.cleanup()
      engineRef.current = null
    }
  }, [isSupported])

  useEffect(() => {
    if (!isSupported || !engineRef.current) return

    if (enabled) {
      engineRef.current.start()
      setIsListening(true)
    } else {
      engineRef.current.stop()
      setIsListening(false)
    }
  }, [enabled, isSupported])

  const muteDuring = useCallback((durationMs: number) => {
    engineRef.current?.mute(durationMs)
  }, [])

  return {
    isSupported,
    isListening,
    lastKeyword,
    muteDuring,
  }
}