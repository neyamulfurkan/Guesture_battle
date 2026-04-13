'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useSocket } from '@/hooks/useSocket'
import { SharePanel } from '@/components/room/SharePanel'
import { CodeInput } from '@/components/room/CodeInput'
import CameraPreview from '@/components/camera/CameraPreview'
import { Button } from '@/components/ui/Button'
import { SOCKET_EVENTS } from '@/lib/gameConstants.server'
import type { HandsResults } from '@/types/mediapipe.d'

const BackgroundParticles = dynamic(() => import('@/components/particles/BackgroundParticles'), {
  ssr: false,
})

type PageState =
  | 'initializing'
  | 'camera_error'
  | 'creating'
  | 'waiting'
  | 'joining'
  | 'connecting'
  | 'error'

const CAMERA_TIMEOUT_MS = 10000

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const code = Array.isArray(params.code) ? params.code[0] : params.code

  const isCreateFlow = code === 'new'

  const { socket, isConnected, joinRoom, on, off } = useSocket()

  const [pageState, setPageState] = useState<PageState>('initializing')
  const [roomCode, setRoomCode] = useState<string>('')
  const [playerId, setPlayerId] = useState<string>('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [landmarkData, setLandmarkData] = useState<HandsResults | null>(null)
  const [isHandDetected, setIsHandDetected] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isJoinLoading, setIsJoinLoading] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const roomCodeRef = useRef<string>('')
  const playerIdRef = useRef<string>('')
  const hasNavigated = useRef(false)

  // Camera init
  useEffect(() => {
    let cancelled = false
    const timeout = setTimeout(() => {
      if (!cancelled && !streamRef.current) {
        setCameraError('Camera took too long to start. Please check that no other app is using it and try again.')
        setPageState('camera_error')
      }
    }, CAMERA_TIMEOUT_MS)

    navigator.mediaDevices
      .getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      })
      .then((ms) => {
        if (cancelled) {
          ms.getTracks().forEach((t) => t.stop())
          return
        }
        clearTimeout(timeout)
        streamRef.current = ms
        setStream(ms)
        setPageState(isCreateFlow ? 'creating' : 'joining')
      })
      .catch((err: DOMException) => {
        if (cancelled) return
        clearTimeout(timeout)
        let msg = 'Could not access your camera. Please check your device and try again.'
        if (err.name === 'NotAllowedError') {
          msg = 'Camera access was denied. Please allow camera access in your browser settings and reload.'
        } else if (err.name === 'NotFoundError') {
          msg = 'No camera found. Please connect a camera and try again.'
        } else if (err.name === 'NotReadableError') {
          msg = 'Your camera is being used by another app. Close Zoom, Teams, or other apps using your camera and try again.'
        }
        setCameraError(msg)
        setPageState('camera_error')
      })

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Create room flow
  useEffect(() => {
    if (pageState !== 'creating') return
if (!isConnected) return

    let cancelled = false

    async function createRoom() {
      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: 'Player' }),
        })
        if (!res.ok) throw new Error('Server error creating room')
        const data = (await res.json()) as { roomCode: string; playerId: string }
        if (cancelled) return

        roomCodeRef.current = data.roomCode
        playerIdRef.current = data.playerId
        setRoomCode(data.roomCode)
        setPlayerId(data.playerId)

        sessionStorage.setItem('roomCode', data.roomCode)
        sessionStorage.setItem('playerId', data.playerId)

        await joinRoom({
          roomCode: data.roomCode,
          playerId: data.playerId,
          displayName: 'Player',
        })

        if (!cancelled) setPageState('waiting')
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Could not create room. Please try again.'
        setCameraError(msg)
        setPageState('error')
      }
    }

    createRoom()
    return () => { cancelled = true }
  }, [pageState, isConnected, joinRoom])

  // Auto-submit join if code param is a valid 6-char code
  useEffect(() => {
    if (pageState !== 'joining' || isCreateFlow) return
    if (!code || code.length !== 6) return
    if (!isConnected) return

    handleJoinSubmit(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState, isConnected, code])

  const handleJoinSubmit = useCallback(
    async (rawCode: string) => {
      if (isJoinLoading) return
      setIsJoinLoading(true)
      setJoinError(null)

      try {
        // Validate room exists
        const checkRes = await fetch(`/api/rooms/${rawCode}`)
        if (!checkRes.ok) throw new Error('Could not reach the server. Please check your connection and try again.')
        const checkData = (await checkRes.json()) as { exists: boolean; state: string | null }
        if (!checkData.exists) {
          setJoinError('Room not found. Check the code and try again.')
          setIsJoinLoading(false)
          return
        }

        const pid = crypto.randomUUID ? crypto.randomUUID() : `player-${Date.now()}`
        roomCodeRef.current = rawCode
        playerIdRef.current = pid
        setRoomCode(rawCode)
        setPlayerId(pid)

        sessionStorage.setItem('roomCode', rawCode)
        sessionStorage.setItem('playerId', pid)

        await joinRoom({
          roomCode: rawCode,
          playerId: pid,
          displayName: 'Player',
        })

        setPageState('connecting')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not join room. Please try again.'
        setJoinError(msg)
      } finally {
        setIsJoinLoading(false)
      }
    },
    [isJoinLoading, joinRoom]
  )

  // Listen for ROOM_STATE_CHANGE → navigate to battle
  useEffect(() => {
    const handleStateChange = (data: { state: string; roomCode?: string }) => {
      if (data.state === 'ready' && !hasNavigated.current) {
        hasNavigated.current = true
        const rc = roomCodeRef.current || data.roomCode || roomCode
        if (rc) {
          router.push(`/room/${rc}/battle`)
        }
      }
    }

    on(SOCKET_EVENTS.ROOM_STATE_CHANGE, handleStateChange as (...args: unknown[]) => void)
    return () => {
      off(SOCKET_EVENTS.ROOM_STATE_CHANGE, handleStateChange as (...args: unknown[]) => void)
    }
  }, [on, off, router, roomCode])

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const formattedCode = roomCode.length === 6
    ? `${roomCode.slice(0, 2)}-${roomCode.slice(2)}`
    : roomCode

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center"
      style={{ background: '#050810' }}
    >
      <BackgroundParticles />

      <div
        className="relative z-10 flex flex-col items-center gap-8 w-full px-4"
        style={{ maxWidth: 520 }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="font-bold uppercase tracking-[8px] text-2xl"
            style={{ color: 'white' }}
          >
            GESTURE
          </span>
          <div style={{ width: 120, height: 1, background: '#3b82f6' }} />
          <span
            className="font-bold uppercase tracking-[8px] text-2xl"
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            BATTLE
          </span>
        </div>

        {/* Camera Error */}
        {(pageState === 'camera_error' || pageState === 'error') && (
          <div
            className="w-full rounded-xl p-6 flex flex-col items-center gap-4 text-center"
            style={{ background: '#0d1117', border: '1px solid #ef4444' }}
          >
            <span style={{ fontSize: 32 }}>📷</span>
            <p style={{ color: '#ef4444', fontSize: 14, lineHeight: 1.5 }}>
              {cameraError || 'An unexpected error occurred. Please reload and try again.'}
            </p>
            <Button
              variant="primary"
              accentColor="blue"
              size="md"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Initializing */}
        {pageState === 'initializing' && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="rounded-full animate-pulse"
              style={{
                width: 64,
                height: 64,
                background: 'rgba(59,130,246,0.15)',
                border: '2px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              📷
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              Starting camera...
            </p>
          </div>
        )}

        {/* Create / Waiting */}
        {(pageState === 'creating' || pageState === 'waiting') && (
          <div
            className="w-full rounded-2xl p-8 flex flex-col items-center gap-8"
            style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex flex-col items-center gap-2">
              <p className="font-bold text-white text-lg">Room Created</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                {pageState === 'creating'
                  ? 'Setting up your room...'
                  : 'Share the code below to invite your opponent'}
              </p>
            </div>

            {pageState === 'waiting' && roomCode && (
              <SharePanel roomCode={roomCode} />
            )}

            {pageState === 'creating' && (
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      background: '#3b82f6',
                      display: 'inline-block',
                      animation: 'waitingDot 1.2s ease-in-out infinite',
                      animationDelay: `${i * 400}ms`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Small camera preview */}
            {stream && (
              <div className="flex flex-col items-center gap-2">
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 2 }}>
                  Your Camera
                </p>
                <CameraPreview
                  stream={stream}
                  landmarkData={landmarkData}
                  showSkeleton={isHandDetected}
                  isHandDetected={isHandDetected}
                  size="sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Join flow */}
        {(pageState === 'joining' || pageState === 'connecting') && !isCreateFlow && (
          <div
            className="w-full rounded-2xl p-8 flex flex-col items-center gap-8"
            style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex flex-col items-center gap-2">
              <p className="font-bold text-white text-lg">Join a Battle</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                {pageState === 'connecting'
                  ? 'Found! Connecting to your opponent...'
                  : 'Enter the room code your opponent shared'}
              </p>
            </div>

            {pageState === 'joining' && (
              <CodeInput
                onSubmit={handleJoinSubmit}
                error={joinError}
                isLoading={isJoinLoading}
              />
            )}

            {pageState === 'connecting' && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="rounded-full"
                      style={{
                        width: 8,
                        height: 8,
                        background: '#22c55e',
                        display: 'inline-block',
                        animation: 'waitingDot 1.2s ease-in-out infinite',
                        animationDelay: `${i * 400}ms`,
                      }}
                    />
                  ))}
                </div>
                <p style={{ fontSize: 13, color: '#22c55e' }}>
                  Connected to room {formattedCode}
                </p>
              </div>
            )}

            {/* Small camera preview */}
            {stream && (
              <div className="flex flex-col items-center gap-2">
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 2 }}>
                  Your Camera
                </p>
                <CameraPreview
                  stream={stream}
                  landmarkData={landmarkData}
                  showSkeleton={isHandDetected}
                  isHandDetected={isHandDetected}
                  size="sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Connection status indicator */}
        <div className="flex items-center gap-2">
          <span
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              background: isConnected ? '#22c55e' : '#ef4444',
              display: 'inline-block',
              boxShadow: isConnected
                ? '0 0 6px rgba(34,197,94,0.6)'
                : '0 0 6px rgba(239,68,68,0.6)',
            }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            {isConnected ? 'Connected to server' : 'Connecting to server...'}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes waitingDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}