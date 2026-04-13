// src/services/faceService.ts
import {
  MEDIAPIPE_MIN_DETECTION_CONFIDENCE,
  MEDIAPIPE_MIN_TRACKING_CONFIDENCE,
} from '@/lib/gameConstants'
import type { FaceMeshResults } from '@/types/mediapipe.d'
import type { FaceExpression } from '@/types/game'

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'

const MOUTH_OPEN_THRESHOLD = 0.04
const EYEBROW_RAISE_THRESHOLD = 0.025
const SQUINT_THRESHOLD = 0.015
const MOUTH_OPEN_HOLD_MS = 1000

export class FaceEngine {
  private faceMesh: InstanceType<typeof window.FaceMesh> | null = null
  private faceFrameSkip: number = 0
  private onExpression: ((expression: FaceExpression) => void) | null = null
  private lastProcessingTime: number = 0
  private isRunning: boolean = false
  private isDisabled: boolean = false
  private videoElement: HTMLVideoElement | null = null
  private detectInterval: ReturnType<typeof setInterval> | null = null

  // Hold-duration tracking
  private mouthOpenStartMs: number | null = null
  private warCryFiredAt: number = 0

  // Expression hold timestamps
  private expressionTimestamps: Partial<Record<FaceExpression, number>> = {}

  setPerformanceMode(disabled: boolean): void {
    this.isDisabled = disabled
  }

  async init(
    videoElement: HTMLVideoElement,
    onExpression: (expression: FaceExpression) => void
  ): Promise<void> {
    this.videoElement = videoElement
    this.onExpression = onExpression

    await this.loadScript()

    this.faceMesh = new window.FaceMesh({
      locateFile: (file: string) => `${CDN_BASE}/${file}`,
    })

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: MEDIAPIPE_MIN_DETECTION_CONFIDENCE,
      minTrackingConfidence: MEDIAPIPE_MIN_TRACKING_CONFIDENCE,
    })

    this.faceMesh.onResults((results: FaceMeshResults) => {
      this.onResults(results)
    })
  }

  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.FaceMesh) {
        resolve()
        return
      }

      const existing = document.querySelector(
        'script[data-mediapipe-facemesh]'
      )
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () =>
          reject(new Error('Failed to load MediaPipe FaceMesh script'))
        )
        return
      }

      const script = document.createElement('script')
      script.src = `${CDN_BASE}/face_mesh.js`
      script.setAttribute('data-mediapipe-facemesh', '1')
      script.crossOrigin = 'anonymous'

      const timeout = setTimeout(() => {
        reject(
          new Error(
            'MediaPipe FaceMesh took too long to load. Check your internet connection and try again.'
          )
        )
      }, 20000)

      script.onload = () => {
        clearTimeout(timeout)
        resolve()
      }

      script.onerror = () => {
        clearTimeout(timeout)
        reject(
          new Error(
            'Could not load face detection. Check your connection and try again.'
          )
        )
      }

      document.body.appendChild(script)
    })
  }

  onResults(results: FaceMeshResults): void {
    if (this.isDisabled || !this.onExpression) return

    const frameStart = performance.now()

    this.faceFrameSkip++

    // Skip every other frame when processing is slow
    if (this.lastProcessingTime > 20 && this.faceFrameSkip % 2 !== 0) return

    if (
      !results.multiFaceLandmarks ||
      results.multiFaceLandmarks.length === 0
    ) {
      this.lastProcessingTime = performance.now() - frameStart
      this.mouthOpenStartMs = null
      return
    }

    const landmarks = results.multiFaceLandmarks[0]
    if (!landmarks || landmarks.length < 468) {
      this.lastProcessingTime = performance.now() - frameStart
      return
    }

    const now = performance.now()

    // ── Mouth open detection ──────────────────────────────────────────────────
    // Landmark 13 = upper lip, 14 = lower lip
    const upperLip = landmarks[13]
    const lowerLip = landmarks[14]
    const lipDistance = Math.abs(lowerLip.y - upperLip.y)

    if (lipDistance > MOUTH_OPEN_THRESHOLD) {
      if (this.mouthOpenStartMs === null) {
        this.mouthOpenStartMs = now
      } else if (
        now - this.mouthOpenStartMs >= MOUTH_OPEN_HOLD_MS &&
        now - this.warCryFiredAt > 3000
      ) {
        // WAR_CRY fires as mouth_open after hold threshold
        this.warCryFiredAt = now
        this.onExpression('mouth_open')
      }
    } else {
      this.mouthOpenStartMs = null
    }

    // ── Eyebrows raised detection ─────────────────────────────────────────────
    // Landmark 10 = forehead mid, 159 = left eye upper lid center
    const forehead = landmarks[10]
    const eyeUpper = landmarks[159]
    const browElevation = eyeUpper.y - forehead.y

    if (browElevation > EYEBROW_RAISE_THRESHOLD) {
      const last = this.expressionTimestamps['eyebrows_raised'] ?? 0
      if (now - last > 2000) {
        this.expressionTimestamps['eyebrows_raised'] = now
        this.onExpression('eyebrows_raised')
      }
    }

    // ── Eye squinting detection ───────────────────────────────────────────────
    // Landmark 159 = upper eyelid, 145 = lower eyelid (left eye)
    const upperEyelid = landmarks[159]
    const lowerEyelid = landmarks[145]
    const eyeAperture = Math.abs(lowerEyelid.y - upperEyelid.y)

    if (eyeAperture < SQUINT_THRESHOLD) {
      const last = this.expressionTimestamps['eyes_squinting'] ?? 0
      if (now - last > 1500) {
        this.expressionTimestamps['eyes_squinting'] = now
        this.onExpression('eyes_squinting')
      }
    }

    this.lastProcessingTime = performance.now() - frameStart
  }

  start(): void {
    if (this.isRunning || !this.faceMesh || !this.videoElement) return
    this.isRunning = true

    this.detectInterval = setInterval(async () => {
      if (!this.isRunning || !this.faceMesh || !this.videoElement) return
      if (
        this.videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      )
        return
      try {
        await this.faceMesh.send({ image: this.videoElement })
      } catch {
        // Silently continue — transient frame errors are expected
      }
    }, 66) // ~15fps — face expressions don't need 30fps
  }

  stop(): void {
    this.isRunning = false
    if (this.detectInterval !== null) {
      clearInterval(this.detectInterval)
      this.detectInterval = null
    }
  }

  cleanup(): void {
    this.stop()
    if (this.faceMesh) {
      try {
        this.faceMesh.close()
      } catch {
        // Ignore cleanup errors
      }
      this.faceMesh = null
    }
    this.onExpression = null
    this.videoElement = null
    this.mouthOpenStartMs = null
    this.expressionTimestamps = {}
  }
}