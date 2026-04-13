'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, ChevronDown, ChevronUp, CheckCircle2, Hand } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import CameraPreview from '@/components/camera/CameraPreview'
import { useGestureEngine } from '@/hooks/useGestureEngine'
import type { HandsResults } from '@/types/mediapipe.d'
import type { GestureId } from '@/types/game'

type FlowState =
  | 'requesting_permission'
  | 'permission_denied'
  | 'camera_unavailable'
  | 'calibrating'
  | 'ready'

interface PermissionCardProps {
  onReady: (stream: MediaStream, landmarkData: HandsResults | null) => void
}

function getErrorState(err: unknown): { state: 'permission_denied' | 'camera_unavailable'; message: string } {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        state: 'permission_denied',
        message:
          'Camera access was denied. Open your browser settings, allow camera access for this site, and refresh.',
      }
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return {
        state: 'camera_unavailable',
        message:
          'No camera was found on this device. Connect a webcam and try again.',
      }
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return {
        state: 'camera_unavailable',
        message:
          'Your camera is being used by another app. Close Zoom, Teams, or other apps using your camera and try again.',
      }
    }
    if (err.name === 'OverconstrainedError') {
      return {
        state: 'camera_unavailable',
        message:
          'Your camera does not support the required resolution. Try a different camera.',
      }
    }
  }
  return {
    state: 'camera_unavailable',
    message: 'Could not access your camera. Check that it is connected and not in use, then try again.',
  }
}

export default function PermissionCard({ onReady }: PermissionCardProps) {
  const [flowState, setFlowState] = useState<FlowState>('requesting_permission')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [gestureEnabled, setGestureEnabled] = useState(false)
  const landmarkDataRef = useRef<HandsResults | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  // dummy ref used to satisfy useGestureEngine signature; CameraPreview owns the real video
  const gestureVideoRef = useRef<HTMLVideoElement>(null)

  const handleGesture = useCallback((_gesture: GestureId) => {
    // Gestures during calibration are ignored for gameplay; we only care about hand detection
  }, [])

  const { isHandDetected, landmarkData } = useGestureEngine(
    gestureVideoRef,
    handleGesture,
    gestureEnabled
  )

  // Keep landmarkDataRef in sync
  useEffect(() => {
    landmarkDataRef.current = landmarkData
  }, [landmarkData])

  // Transition to ready when hand is detected during calibration
  useEffect(() => {
    if (flowState === 'calibrating' && isHandDetected) {
      setFlowState('ready')
    }
  }, [isHandDetected, flowState])

  // Request camera on mount
  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const requestCamera = async () => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new DOMException('Camera access timed out.', 'TimeoutError'))
        }, 10_000)
      })

      try {
        const mediaStream = await Promise.race([
          navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, frameRate: 30 },
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
          }),
          timeoutPromise,
        ])

        if (timeoutId) clearTimeout(timeoutId)
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop())
          return
        }

        setStream(mediaStream)
        setFlowState('calibrating')

        // Attach stream to the gesture engine's video ref after a short tick
        // so the DOM element is rendered
        setTimeout(() => {
          if (gestureVideoRef.current) {
            gestureVideoRef.current.srcObject = mediaStream
            gestureVideoRef.current.play().catch(() => {})
          }
          setGestureEnabled(true)
        }, 100)
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId)
        if (cancelled) return
        const { state, message } = getErrorState(err)
        setErrorMessage(message)
        setFlowState(state)
      }
    }

    requestCamera()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [stream])

  const handleContinue = useCallback(() => {
    if (stream) {
      onReady(stream, landmarkDataRef.current)
    }
  }, [stream, onReady])

  const handleRetry = useCallback(() => {
    setFlowState('requesting_permission')
    setErrorMessage('')
    setGestureEnabled(false)
    setStream(null)

    // Re-trigger camera request by reloading
    window.location.reload()
  }, [])

  // ─── RENDER STATES ──────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0d1117',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  }

  return (
    <div style={cardStyle}>
      {/* ── REQUESTING PERMISSION ── */}
      {flowState === 'requesting_permission' && (
        <>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                border: '2px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'glow-pulse 1.2s ease-in-out infinite',
                boxShadow: '0 0 12px rgba(59,130,246,0.5), 0 0 32px rgba(59,130,246,0.25)',
              }}
            >
              <Camera size={36} color="#3b82f6" />
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>
              Camera Access Needed
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>
              GestureBattle uses your camera to detect hand gestures. Nothing is recorded or stored — detection happens entirely in your browser.
            </p>
          </div>

          <div
            style={{
              width: '100%',
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '40%',
                borderRadius: 2,
                background: '#3b82f6',
                animation: 'shimmer-sweep 1.5s ease-in-out infinite',
              }}
            />
          </div>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            Waiting for camera permission…
          </p>
        </>
      )}

      {/* ── PERMISSION DENIED / UNAVAILABLE ── */}
      {(flowState === 'permission_denied' || flowState === 'camera_unavailable') && (
        <>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(239,68,68,0.4)',
            }}
          >
            <Camera size={36} color="#ef4444" />
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', margin: '0 0 10px' }}>
              {flowState === 'permission_denied' ? 'Camera Access Denied' : 'Camera Unavailable'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.7 }}>
              {errorMessage}
            </p>
          </div>

          <Button
            variant="primary"
            accentColor="blue"
            size="md"
            onClick={handleRetry}
          >
            Try Again
          </Button>
        </>
      )}

      {/* ── CALIBRATING ── */}
      {flowState === 'calibrating' && (
        <>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, textAlign: 'center' }}>
            Show Your Hand
          </p>

          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
            Hold an open hand in front of your camera so we can confirm gesture detection works on your device.
          </p>

          {/* Hand silhouette hint */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '12px 20px',
              borderRadius: 12,
              backgroundColor: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              width: '100%',
            }}
          >
            <Hand size={24} color="#3b82f6" />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              Open your palm toward the camera
            </span>
          </div>

          <CameraPreview
            stream={stream}
            landmarkData={landmarkData}
            showSkeleton={true}
            isHandDetected={isHandDetected}
            size="md"
          />

          {/* Hidden video for gesture engine */}
          <video
            ref={gestureVideoRef}
            autoPlay
            playsInline
            muted
            style={{ display: 'none' }}
          />

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            Detecting hand landmarks…
          </p>
        </>
      )}

      {/* ── READY ── */}
      {flowState === 'ready' && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              borderRadius: 12,
              backgroundColor: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            <CheckCircle2 size={20} color="#22c55e" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
              Hand Detected!
            </span>
          </div>

          <CameraPreview
            stream={stream}
            landmarkData={landmarkData}
            showSkeleton={true}
            isHandDetected={true}
            size="md"
          />

          {/* Hidden video for gesture engine */}
          <video
            ref={gestureVideoRef}
            autoPlay
            playsInline
            muted
            style={{ display: 'none' }}
          />

          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center' }}>
            Gesture detection is working. You're ready to battle.
          </p>

          <Button
            variant="primary"
            accentColor="blue"
            size="lg"
            onClick={handleContinue}
            style={{ width: '100%' }}
          >
            Continue →
          </Button>
        </>
      )}

      {/* ── HOW DOES THIS WORK? ── */}
      <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
        <button
          type="button"
          onClick={() => setShowExplanation((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 12,
            padding: 0,
            width: '100%',
          }}
        >
          {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          How does this work?
        </button>

        {showExplanation && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: 'rgba(255,255,255,0.45)',
              lineHeight: 1.7,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'rgba(255,255,255,0.7)' }}>No recording.</strong> Your camera feed never leaves your device. All gesture detection runs locally in your browser using MediaPipe — an open-source ML library from Google.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'rgba(255,255,255,0.7)' }}>No storage.</strong> Video frames are processed in real time and immediately discarded. Nothing is saved to any server.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Peer-to-peer video.</strong> During the battle your live video is sent directly to your opponent via WebRTC — not through our servers.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}