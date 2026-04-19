// src/services/gestureService.ts

import {
  GESTURE_HOLD_FRAMES_SHIELD,
  GESTURE_HOLD_FRAMES_PUNCH,
  GESTURE_HOLD_FRAMES_ZAP,
  GESTURE_HOLD_FRAMES_HEAL,
  GESTURE_INTERVAL_MS,
  GESTURE_SWIPE_MIN_PX,
  GESTURE_SWIPE_MAX_FRAMES,
  GESTURE_PALM_PUSH_AREA_INCREASE,
  GESTURE_PALM_PUSH_FRAMES,
  GESTURE_WRIST_SPIN_MIN_RADIUS,
  GESTURE_WRIST_SPIN_FRAMES,
  MEDIAPIPE_MIN_DETECTION_CONFIDENCE,
  MEDIAPIPE_MIN_TRACKING_CONFIDENCE,
  MEDIAPIPE_MAX_NUM_HANDS,
} from '@/lib/gameConstants'
import type { HandsResults, NormalizedLandmarkList } from '@/types/mediapipe.d'
import type { GestureId } from '@/types/game'
import { distancePx, boundingBoxArea } from '@/lib/utils'

// ─── GESTURE STATE MACHINE ────────────────────────────────────────────────────

class GestureStateMachine {
  private frameCounts: Map<GestureId, number> = new Map()

  confirmGesture(gesture: GestureId, required: number): boolean {
    const current = (this.frameCounts.get(gesture) ?? 0) + 1
    this.frameCounts.set(gesture, current)

    if (current >= required) {
      // Reset this gesture count to require full re-hold before firing again
      this.frameCounts.set(gesture, 0)
      // Reset all other gesture counts too
      for (const key of this.frameCounts.keys()) {
        if (key !== gesture) {
          this.frameCounts.set(key, 0)
        }
      }
      return true
    }
    return false
  }

  releaseGesture(gesture: GestureId): void {
    this.frameCounts.set(gesture, 0)
  }

  reset(): void {
    this.frameCounts.clear()
  }
}

// ─── GESTURE ENGINE ───────────────────────────────────────────────────────────

export class GestureEngine {
  private handsRef: InstanceType<typeof window.Hands> | null = null
  private cameraRef: InstanceType<typeof window.Camera> | null = null
  private stateMachine: GestureStateMachine = new GestureStateMachine()
  private isRunning: boolean = false
  private detectInterval: ReturnType<typeof setInterval> | null = null
  private videoElement: HTMLVideoElement | null = null
  private onGestureCallback: (gesture: GestureId) => void

  // Null-frame tolerance: how many consecutive null frames before resetting counts
  // Prevents a single dropped frame from breaking a hold gesture like shield
  private nullFrameCount: number = 0
  private static readonly NULL_FRAME_TOLERANCE = 4

  // Swipe tracking
  private palmPositionHistory: Array<{ x: number; y: number; frame: number }> = []
  private swipeFrameCounter: number = 0

  // Both-hands push tracking (circular buffer of 5 areas)
  private palmAreaHistory: number[] = []
  private palmAreaFrameIndex: number = 0

  // Wrist spin tracking
  private wristSpinHistory: Array<{ x: number; y: number }> = []

  constructor(onGesture: (gesture: GestureId) => void) {
    this.onGestureCallback = onGesture
  }

  async init(videoElement: HTMLVideoElement): Promise<void> {
    this.videoElement = videoElement

    await this.loadMediaPipeScript()

    const hands = new window.Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    })

    hands.setOptions({
      maxNumHands: MEDIAPIPE_MAX_NUM_HANDS,
      modelComplexity: 1,
      minDetectionConfidence: MEDIAPIPE_MIN_DETECTION_CONFIDENCE,
      minTrackingConfidence: MEDIAPIPE_MIN_TRACKING_CONFIDENCE,
    })

    hands.onResults((results: HandsResults) => {
      this.onResults(results)
    })

    this.handsRef = hands

    const camera = new window.Camera(videoElement, {
      onFrame: async () => {
        if (this.handsRef && this.isRunning) {
          await this.handsRef.send({ image: videoElement })
        }
      },
      width: 640,
      height: 480,
    })

    this.cameraRef = camera
  }

  private loadMediaPipeScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.Hands) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        reject(
          new Error(
            'MediaPipe failed to load within 20 seconds. Check your internet connection and try again.'
          )
        )
      }, 20000)

      const loadScript = (src: string): Promise<void> =>
        new Promise((res, rej) => {
          const existing = document.querySelector(`script[src="${src}"]`)
          if (existing) {
            res()
            return
          }
          const script = document.createElement('script')
          script.src = src
          script.async = true
          script.onload = () => res()
          script.onerror = () =>
            rej(new Error(`Failed to load script: ${src}`))
          document.body.appendChild(script)
        })

      Promise.all([
        loadScript(
          'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
        ),
        loadScript(
          'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
        ),
      ])
        .then(() => {
          clearTimeout(timeout)
          resolve()
        })
        .catch((err) => {
          clearTimeout(timeout)
          reject(err)
        })
    })
  }

  start(): void {
    if (this.isRunning || !this.cameraRef) return
    this.isRunning = true
    this.cameraRef.start().catch(() => {
      // Camera start failed silently — will retry via interval
    })
  }

  stop(): void {
    this.isRunning = false

    if (this.detectInterval !== null) {
      clearInterval(this.detectInterval)
      this.detectInterval = null
    }

    if (this.cameraRef) {
      this.cameraRef.stop()
      this.cameraRef = null
    }

    if (this.handsRef) {
      this.handsRef.close()
      this.handsRef = null
    }

    this.stateMachine.reset()
    this.nullFrameCount = 0
    this.palmPositionHistory = []
    this.palmAreaHistory = []
    this.wristSpinHistory = []
  }

  getCurrentLandmarkData(): HandsResults | null {
    return this._lastResults ?? null
  }

  private _lastResults: HandsResults | null = null

  onResults(results: HandsResults): void {
    if (!this.isRunning) return

    const gesture = this.detectGesture(results)
    this.swipeFrameCounter++

    if (gesture === null) {
      // Allow a few null frames before resetting — prevents single dropped frames
      // from breaking hold gestures like shield that require many consecutive frames
      this.nullFrameCount++
      if (this.nullFrameCount >= GestureEngine.NULL_FRAME_TOLERANCE) {
        this.stateMachine.reset()
        this.nullFrameCount = 0
      }
      return
    }

    this.nullFrameCount = 0

    const requiredFrames = this.getRequiredFrames(gesture)
    const confirmed = this.stateMachine.confirmGesture(gesture, requiredFrames)

    if (confirmed) {
      this.onGestureCallback(gesture)
    }
  }

  private getRequiredFrames(gesture: GestureId): number {
    switch (gesture) {
      case 'open_palm':
        return GESTURE_HOLD_FRAMES_SHIELD
      case 'fist':
        return GESTURE_HOLD_FRAMES_PUNCH
      case 'index_point':
        return GESTURE_HOLD_FRAMES_ZAP
      case 'shaka':
        return GESTURE_HOLD_FRAMES_HEAL
      default:
        return 3
    }
  }

  private detectGesture(results: HandsResults): GestureId | null {
    const { multiHandLandmarks } = results

    if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
      this.palmPositionHistory = []
      this.wristSpinHistory = []
      return null
    }

    const videoWidth = this.videoElement?.videoWidth ?? 640
    const videoHeight = this.videoElement?.videoHeight ?? 480

    // Both-hands push requires exactly 2 hands
    if (multiHandLandmarks.length === 2) {
      const bothHandsPush = this.detectBothHandsPush(
        multiHandLandmarks,
        videoWidth,
        videoHeight
      )
      if (bothHandsPush) return 'both_hands_push'

      const bothHandsOpen = this.detectBothHandsOpen(
        multiHandLandmarks,
        videoWidth,
        videoHeight
      )
      if (bothHandsOpen) return 'both_hands_open'
    }

    // Single-hand gestures — use first hand
    const landmarks = multiHandLandmarks[0]
    if (!landmarks || landmarks.length < 21) return null

    // Convert normalized landmarks to pixel coordinates
    const px = (i: number): { x: number; y: number; z: number } => ({
      x: landmarks[i].x * videoWidth,
      y: landmarks[i].y * videoHeight,
      z: landmarks[i].z,
    })

    const wrist = px(0)
    const thumbTip = px(4)
    const indexMcp = px(5)
    const indexTip = px(8)
    const middleMcp = px(9)
    const middleTip = px(12)
    const ringMcp = px(13)
    const ringTip = px(16)
    const pinkyMcp = px(17)
    const pinkyTip = px(20)
    const palmCenter = px(9) // landmark 9 is middle finger MCP, good palm center proxy

    // ─── FIST ──────────────────────────────────────────────────────
    // All four finger tips close to palm center AND thumb tip close to index MCP.
    // Use stricter threshold (40px) to avoid false fist during open-palm transitions.
    const fistThreshold = 40
    const allCurled =
      distancePx(indexTip.x, indexTip.y, palmCenter.x, palmCenter.y) < fistThreshold &&
      distancePx(middleTip.x, middleTip.y, palmCenter.x, palmCenter.y) < fistThreshold &&
      distancePx(ringTip.x, ringTip.y, palmCenter.x, palmCenter.y) < fistThreshold &&
      distancePx(pinkyTip.x, pinkyTip.y, palmCenter.x, palmCenter.y) < fistThreshold &&
      distancePx(thumbTip.x, thumbTip.y, indexMcp.x, indexMcp.y) < fistThreshold * 1.5

    if (allCurled) return 'fist'

    // ─── OPEN PALM ─────────────────────────────────────────────────
    // Use landmark 1 (thumb CMC base) instead of 2 for more stable thumb extension measure.
    // Require all four fingers AND thumb extended. Use 55px threshold — reliable across
    // hand sizes and distances without being too strict.
    const extendThreshold = 55
    const thumbCmc = px(1)
    const allExtended =
      distancePx(thumbTip.x, thumbTip.y, thumbCmc.x, thumbCmc.y) > extendThreshold * 1.4 &&
      distancePx(indexTip.x, indexTip.y, indexMcp.x, indexMcp.y) > extendThreshold &&
      distancePx(middleTip.x, middleTip.y, middleMcp.x, middleMcp.y) > extendThreshold &&
      distancePx(ringTip.x, ringTip.y, ringMcp.x, ringMcp.y) > extendThreshold &&
      distancePx(pinkyTip.x, pinkyTip.y, pinkyMcp.x, pinkyMcp.y) > extendThreshold

    if (allExtended) return 'open_palm'

    // ─── INDEX POINT ───────────────────────────────────────────────
    const indexExtended =
      distancePx(indexTip.x, indexTip.y, indexMcp.x, indexMcp.y) > extendThreshold
    const middleCurled =
      distancePx(middleTip.x, middleTip.y, middleMcp.x, middleMcp.y) < fistThreshold
    const ringCurled =
      distancePx(ringTip.x, ringTip.y, ringMcp.x, ringMcp.y) < fistThreshold
    const pinkyCurled =
      distancePx(pinkyTip.x, pinkyTip.y, pinkyMcp.x, pinkyMcp.y) < fistThreshold

    if (indexExtended && middleCurled && ringCurled && pinkyCurled) return 'index_point'

    // ─── PEACE SIGN ────────────────────────────────────────────────
    const middleExtended =
      distancePx(middleTip.x, middleTip.y, middleMcp.x, middleMcp.y) > extendThreshold

    if (
      indexExtended &&
      middleExtended &&
      ringCurled &&
      pinkyCurled
    )
      return 'peace_sign'

    // ─── SHAKA ─────────────────────────────────────────────────────
    // Shaka (hang loose): thumb and pinky both extended, middle/ring/index curled.
    // Detection uses distance from wrist — works regardless of hand rotation.
    const shakaThreshold = 50
    const thumbExtendedFromWrist =
      distancePx(thumbTip.x, thumbTip.y, wrist.x, wrist.y) > shakaThreshold * 1.5
    const pinkyExtendedFromWrist =
      distancePx(pinkyTip.x, pinkyTip.y, wrist.x, wrist.y) > shakaThreshold
    const middleCurledShaka =
      distancePx(middleTip.x, middleTip.y, middleMcp.x, middleMcp.y) < fistThreshold
    const ringCurledShaka =
      distancePx(ringTip.x, ringTip.y, ringMcp.x, ringMcp.y) < fistThreshold
    const indexCurledShaka =
      distancePx(indexTip.x, indexTip.y, indexMcp.x, indexMcp.y) < fistThreshold

    if (thumbExtendedFromWrist && pinkyExtendedFromWrist && middleCurledShaka && ringCurledShaka && indexCurledShaka)
      return 'shaka'

    // ─── THUMBS UP ─────────────────────────────────────────────────
    const thumbsUpThreshold = 80
    const thumbAboveWrist = wrist.y - thumbTip.y > thumbsUpThreshold
    const fingersBelowMcps =
      indexTip.y > indexMcp.y &&
      middleTip.y > middleMcp.y &&
      ringTip.y > ringMcp.y &&
      pinkyTip.y > pinkyMcp.y

    if (thumbAboveWrist && fingersBelowMcps) return 'thumbs_up'

    // ─── THUMBS DOWN ───────────────────────────────────────────────
    const thumbBelowWrist = thumbTip.y - wrist.y > thumbsUpThreshold

    if (thumbBelowWrist && fingersBelowMcps) return 'thumbs_down'

    // ─── SWIPE LEFT / SWIPE RIGHT ──────────────────────────────────
    const swipeResult = this.detectSwipe(palmCenter, videoWidth)
    if (swipeResult) return swipeResult

    // ─── WRIST SPIN ────────────────────────────────────────────────
    const wristSpinResult = this.detectWristSpin(palmCenter)
    if (wristSpinResult) return wristSpinResult

    return null
  }

  private detectSwipe(
    palmCenter: { x: number; y: number },
    videoWidth: number
  ): GestureId | null {
    this.palmPositionHistory.push({
      x: palmCenter.x,
      y: palmCenter.y,
      frame: this.swipeFrameCounter,
    })

    // Keep only recent frames
    const maxHistory = GESTURE_SWIPE_MAX_FRAMES + 1
    if (this.palmPositionHistory.length > maxHistory) {
      this.palmPositionHistory.shift()
    }

    if (this.palmPositionHistory.length < 2) return null

    const oldest = this.palmPositionHistory[0]
    const newest = this.palmPositionHistory[this.palmPositionHistory.length - 1]
    const frameDelta = newest.frame - oldest.frame
    const xDelta = newest.x - oldest.x

    if (frameDelta <= GESTURE_SWIPE_MAX_FRAMES) {
      if (xDelta > GESTURE_SWIPE_MIN_PX) {
        this.palmPositionHistory = []
        return 'swipe_right'
      }
      if (xDelta < -GESTURE_SWIPE_MIN_PX) {
        this.palmPositionHistory = []
        return 'swipe_left'
      }
    }

    // Prune old entries beyond the window
    if (frameDelta > GESTURE_SWIPE_MAX_FRAMES) {
      this.palmPositionHistory.shift()
    }

    return null
  }

  private detectWristSpin(palmCenter: { x: number; y: number }): GestureId | null {
    this.wristSpinHistory.push({ x: palmCenter.x, y: palmCenter.y })

    if (this.wristSpinHistory.length > GESTURE_WRIST_SPIN_FRAMES) {
      this.wristSpinHistory.shift()
    }

    if (this.wristSpinHistory.length < GESTURE_WRIST_SPIN_FRAMES) return null

    // Compute centroid
    let cx = 0
    let cy = 0
    for (const p of this.wristSpinHistory) {
      cx += p.x
      cy += p.y
    }
    cx /= this.wristSpinHistory.length
    cy /= this.wristSpinHistory.length

    // Compute average radius from centroid
    let avgRadius = 0
    for (const p of this.wristSpinHistory) {
      avgRadius += distancePx(p.x, p.y, cx, cy)
    }
    avgRadius /= this.wristSpinHistory.length

    if (avgRadius > GESTURE_WRIST_SPIN_MIN_RADIUS) {
      this.wristSpinHistory = []
      return 'wrist_spin'
    }

    return null
  }

  private detectBothHandsPush(
    multiHandLandmarks: NormalizedLandmarkList[],
    videoWidth: number,
    videoHeight: number
  ): boolean {
    const hand1Landmarks = multiHandLandmarks[0]
    const hand2Landmarks = multiHandLandmarks[1]

    const area1 = boundingBoxArea(
      hand1Landmarks.map((lm) => ({ x: lm.x, y: lm.y })),
      videoWidth,
      videoHeight
    )
    const area2 = boundingBoxArea(
      hand2Landmarks.map((lm) => ({ x: lm.x, y: lm.y })),
      videoWidth,
      videoHeight
    )
    const totalArea = area1 + area2

    // Maintain circular buffer of size GESTURE_PALM_PUSH_FRAMES
    if (this.palmAreaHistory.length < GESTURE_PALM_PUSH_FRAMES) {
      this.palmAreaHistory.push(totalArea)
      return false
    }

    this.palmAreaHistory[this.palmAreaFrameIndex % GESTURE_PALM_PUSH_FRAMES] = totalArea
    this.palmAreaFrameIndex++

    const minArea = Math.min(...this.palmAreaHistory)
    const maxArea = Math.max(...this.palmAreaHistory)

    if (minArea > 0 && (maxArea - minArea) / minArea > GESTURE_PALM_PUSH_AREA_INCREASE) {
      this.palmAreaHistory = []
      this.palmAreaFrameIndex = 0
      return true
    }

    return false
  }

  private detectBothHandsOpen(
    multiHandLandmarks: NormalizedLandmarkList[],
    videoWidth: number,
    videoHeight: number
  ): boolean {
    const extendThreshold = 60

    for (const landmarks of multiHandLandmarks) {
      if (landmarks.length < 21) return false

      const px = (i: number) => ({
        x: landmarks[i].x * videoWidth,
        y: landmarks[i].y * videoHeight,
        z: landmarks[i].z,
      })

      const thumbMcp = px(2)
      const thumbTip = px(4)
      const indexMcp = px(5)
      const indexTip = px(8)
      const middleMcp = px(9)
      const middleTip = px(12)
      const ringMcp = px(13)
      const ringTip = px(16)
      const pinkyMcp = px(17)
      const pinkyTip = px(20)

      const allExtended =
        distancePx(thumbTip.x, thumbTip.y, thumbMcp.x, thumbMcp.y) > extendThreshold &&
        distancePx(indexTip.x, indexTip.y, indexMcp.x, indexMcp.y) > extendThreshold &&
        distancePx(middleTip.x, middleTip.y, middleMcp.x, middleMcp.y) > extendThreshold &&
        distancePx(ringTip.x, ringTip.y, ringMcp.x, ringMcp.y) > extendThreshold &&
        distancePx(pinkyTip.x, pinkyTip.y, pinkyMcp.x, pinkyMcp.y) > extendThreshold

      if (!allExtended) return false
    }

    return true
  }
}