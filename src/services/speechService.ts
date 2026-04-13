// src/services/speechService.ts
// Web Speech API wrapper with keep-alive restart loop, rate limiting, and mute support.

import {
  VOICE_KEYWORD_COOLDOWN_MS,
  VOICE_RESTART_DELAY_MS,
} from '@/lib/gameConstants'
import type { VoiceKeyword } from '@/types/game'
import { normalizeVoiceKeyword } from '@/lib/utils'

// Extend window with webkit prefixed speech recognition
declare global {
  // Window augmentation handled via any casts in implementation to avoid
  // conflicts with lib.dom.d.ts SpeechRecognition declarations
}

const VOICE_KEYWORDS: VoiceKeyword[] = ['FIRE', 'NOW', 'ULTIMATE', 'SHIELD', 'GO', 'STOP']

export class SpeechEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null
  private isActive: boolean = false
  private lastKeywordTimestamps: Map<VoiceKeyword, number> = new Map()
  private onKeyword: ((keyword: VoiceKeyword) => void) | null = null
  private isMuted: boolean = false
  private battleActive: boolean = false
  private muteTimer: ReturnType<typeof setTimeout> | null = null

  static isSupported(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition)
    )
  }

  init(onKeyword: (keyword: VoiceKeyword) => void): void {
    if (!SpeechEngine.isSupported()) return

    this.onKeyword = onKeyword
    this.lastKeywordTimestamps = new Map()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionImpl = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionImpl) return

    this.recognition = new SpeechRecognitionImpl()

    this.recognition.continuous = true
    this.recognition.interimResults = false
    this.recognition.lang = 'en-US'
    this.recognition.maxAlternatives = 1

    this.recognition.onresult = (event: any) => {
      if (this.isMuted) return

      const result = event.results[event.resultIndex]
      if (!result) return

      const transcript = result[0].transcript
      const normalized = normalizeVoiceKeyword(transcript)

      for (const keyword of VOICE_KEYWORDS) {
        if (normalized.includes(keyword)) {
          const now = Date.now()
          const lastTimestamp = this.lastKeywordTimestamps.get(keyword) ?? 0

          if (now - lastTimestamp < VOICE_KEYWORD_COOLDOWN_MS) continue

          this.lastKeywordTimestamps.set(keyword, now)
          this.onKeyword?.(keyword)
          break
        }
      }
    }

    this.recognition.onend = () => {
      if (!this.battleActive) return
      setTimeout(() => {
        if (this.battleActive && this.recognition) {
          try {
            this.recognition.start()
          } catch {
            // Recognition may already be starting; ignore
          }
        }
      }, VOICE_RESTART_DELAY_MS)
    }

    this.recognition.onerror = (event: any) => {
      // 'no-speech' and 'aborted' are expected during normal operation
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.battleActive = false
      }
    }
  }

  start(): void {
    if (!this.recognition) return
    this.battleActive = true
    try {
      this.recognition.start()
    } catch {
      // Already started; ignore
    }
  }

  stop(): void {
    if (!this.recognition) return
    this.battleActive = false
    try {
      this.recognition.stop()
    } catch {
      // Already stopped; ignore
    }
  }

  mute(durationMs: number): void {
    this.isMuted = true
    if (this.muteTimer !== null) {
      clearTimeout(this.muteTimer)
    }
    this.muteTimer = setTimeout(() => {
      this.isMuted = false
      this.muteTimer = null
    }, durationMs)
  }

  cleanup(): void {
    this.battleActive = false
    if (this.muteTimer !== null) {
      clearTimeout(this.muteTimer)
      this.muteTimer = null
    }
    if (this.recognition) {
      try {
        this.recognition.abort()
      } catch {
        // Already aborted; ignore
      }
    }
    this.recognition = null
    this.onKeyword = null
  }
}