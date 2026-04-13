// src/lib/audioManager.ts

export type SoundId =
  | 'fire_punch_impact'
  | 'zap_impact'
  | 'shield_activate'
  | 'shield_block'
  | 'heal'
  | 'ice_freeze'
  | 'thunder_strike'
  | 'dragon_blast'
  | 'victory'
  | 'defeat'
  | 'combo_success'
  | 'parry'
  | 'dodge'
  | 'countdown_tick'
  | 'fight_start'
  | 'whoosh'
  | 'click'

const SOUND_URLS: Record<SoundId, string> = {
  fire_punch_impact: '/sounds/fire_punch_impact.mp3',
  zap_impact: '/sounds/zap_impact.mp3',
  shield_activate: '/sounds/shield_activate.mp3',
  shield_block: '/sounds/shield_block.mp3',
  heal: '/sounds/heal.mp3',
  ice_freeze: '/sounds/ice_freeze.mp3',
  thunder_strike: '/sounds/thunder_strike.mp3',
  dragon_blast: '/sounds/dragon_blast.mp3',
  victory: '/sounds/victory.mp3',
  defeat: '/sounds/defeat.mp3',
  combo_success: '/sounds/combo_success.mp3',
  parry: '/sounds/parry.mp3',
  dodge: '/sounds/dodge.mp3',
  countdown_tick: '/sounds/countdown_tick.mp3',
  fight_start: '/sounds/fight_start.mp3',
  whoosh: '/sounds/whoosh.mp3',
  click: '/sounds/click.mp3',
}

class AudioManager {
  private context: AudioContext | null = null
  private gainNode: GainNode | null = null
  private buffers: Map<SoundId, AudioBuffer> = new Map()
  private ready = false
  private volume = 1

  async init(): Promise<void> {
    if (this.ready) return

    this.context = new AudioContext()
    this.gainNode = this.context.createGain()
    this.gainNode.gain.value = this.volume
    this.gainNode.connect(this.context.destination)

    const soundIds = Object.keys(SOUND_URLS) as SoundId[]

    await Promise.allSettled(
      soundIds.map(async (id) => {
        try {
          const response = await fetch(SOUND_URLS[id])
          if (!response.ok) return
          const arrayBuffer = await response.arrayBuffer()
          const audioBuffer = await this.context!.decodeAudioData(arrayBuffer)
          this.buffers.set(id, audioBuffer)
        } catch {
          // fail silently — missing sound files are non-fatal
        }
      })
    )

    this.ready = true
  }

  playSound(soundId: SoundId): void {
    if (!this.context || !this.gainNode) return

    const buffer = this.buffers.get(soundId)
    if (!buffer) return

    const play = () => {
      try {
        const source = this.context!.createBufferSource()
        source.buffer = buffer
        source.connect(this.gainNode!)
        source.start(0)
      } catch {
        // fail silently
      }
    }

    if (this.context.state === 'suspended') {
      this.context.resume().then(play).catch(() => {})
    } else {
      play()
    }
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value))
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume
    }
  }

  isReady(): boolean {
    return this.ready
  }
}

export const audioManager = new AudioManager()