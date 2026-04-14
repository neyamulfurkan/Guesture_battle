'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Settings } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useGestureEngine } from '@/hooks/useGestureEngine'
import { useSpeechEngine } from '@/hooks/useSpeechEngine'
import { useFaceEngine } from '@/hooks/useFaceEngine'
import { useGameState } from '@/hooks/useGameState'
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'
import VideoTile from '@/components/battle/VideoTile'
import { PowerBar } from '@/components/battle/PowerBar'
import { ComboBar } from '@/components/battle/ComboBar'
import { BattleLog } from '@/components/battle/BattleLog'
import { AttackEffectZone } from '@/components/battle/AttackEffectZone'
import { SettingsPanel } from '@/components/battle/SettingsPanel'
import { ReconnectOverlay } from '@/components/battle/ReconnectOverlay'
import { CountdownOverlay } from '@/components/room/CountdownOverlay'
import { useToast } from '@/components/ui/Toast'
import { audioManager } from '@/lib/audioManager'
import { RECONNECT_WINDOW_MS, COUNTDOWN_START } from '@/lib/gameConstants'
import { SOCKET_EVENTS } from '@/lib/gameConstants.server'
import type { GameSettings, GestureId, VoiceKeyword, FaceExpression, GameEvent } from '@/types/game'

const BackgroundParticles = dynamic(() => import('@/components/particles/BackgroundParticles'), {
  ssr: false,
})

const DEFAULT_SETTINGS: GameSettings = {
  gestureSensitivity: 'normal',
  voiceDetection: true,
  faceExpressions: true,
  sfxVolume: 80,
  showHandSkeleton: true,
  showPowerTooltips: true,
  gestureNavigation: false,
  touchControls: false,
}

function generateLocalPlayerId(): string {
  const stored = sessionStorage.getItem('playerId')
  if (stored) return stored
  const id = Math.random().toString(36).slice(2, 11)
  sessionStorage.setItem('playerId', id)
  return id
}

export default function BattlePage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = (params?.code as string) ?? ''
  const { addToast } = useToast()

  // ── Settings ────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // ── Countdown ───────────────────────────────────────────────────────────────
  const [countdownValue, setCountdownValue] = useState<number | 'FIGHT!' | null>(null)
  const [battleActive, setBattleActive] = useState(false)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Reconnection ────────────────────────────────────────────────────────────
  const [reconnectVisible, setReconnectVisible] = useState(false)
  const [reconnectSeconds, setReconnectSeconds] = useState(0)
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Battle events log ────────────────────────────────────────────────────────
  const [battleEvents, setBattleEvents] = useState<GameEvent[]>([])

  // ── Voice level (for ComboBar waveform) ────────────────────────────────────
  const [voiceLevel] = useState(0)

  // ── Refs ────────────────────────────────────────────────────────────────────
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const gestureSourceVideoRef = useRef<HTMLVideoElement>(null)
  const localPlayerId = useRef(generateLocalPlayerId()).current
  const audioInitRef = useRef(false)
  const nowTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const { socket, isConnected } = useSocket()
  const { localStream, remoteStream, initiate, sendGameEvent, isUsingFallback } = useWebRTC(socket)
  const { performanceMode } = usePerformanceMonitor()

  const {
    roomData,
    animationState,
    localPlayerState,
    remotePlayerState,
    handleGesture,
    handleVoiceKeyword,
    handleFaceExpression,
    comboState,
  } = useGameState(socket, roomCode, localPlayerId)

  // ── Gesture video ref: resolve from local stream video element ──────────────
  const gestureVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!localStream) return
    // Find the local video element by scanning all video elements
    const tryFind = () => {
      const videos = document.querySelectorAll<HTMLVideoElement>('video')
      for (const v of videos) {
        if (v.srcObject === localStream && v.readyState >= 1) {
          gestureVideoRef.current = v
          return
        }
      }
      // Not ready yet — retry
      setTimeout(tryFind, 150)
    }
    tryFind()
  }, [localStream])

  const onGestureWrapped = useCallback(
    (gesture: GestureId) => {
      if (!battleActive) return
      handleGesture(gesture)
    },
    [battleActive, handleGesture]
  )

  const onKeywordWrapped = useCallback(
    (keyword: VoiceKeyword) => {
      if (!battleActive) return
      handleVoiceKeyword(keyword)
    },
    [battleActive, handleVoiceKeyword]
  )

  const onExpressionWrapped = useCallback(
    (expression: FaceExpression) => {
      if (!battleActive) return
      handleFaceExpression(expression)
    },
    [battleActive, handleFaceExpression]
  )

  const { isDetecting, isHandDetected, landmarkData } = useGestureEngine(
    gestureSourceVideoRef,
    onGestureWrapped,
    !!localStream
  )

  const { isSupported: isSpeechSupported, isListening, lastKeyword } = useSpeechEngine(
    onKeywordWrapped,
    battleActive && settings.voiceDetection
  )

  useFaceEngine(
    gestureSourceVideoRef,
    onExpressionWrapped,
    battleActive && settings.faceExpressions
  )

  // ── Audio init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioInitRef.current) {
      audioInitRef.current = true
      audioManager.init().catch(() => {})
    }
  }, [])

  // ── Volume sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    audioManager.setVolume(settings.sfxVolume / 100)
  }, [settings.sfxVolume])

  // ── Now tick for cooldown progress ──────────────────────────────────────────
  useEffect(() => {
    nowTickRef.current = setInterval(() => setNow(Date.now()), 100)
    return () => {
      if (nowTickRef.current) clearInterval(nowTickRef.current)
    }
  }, [])

  // ── WebRTC initiation — called on mount once socket is connected ────────────
  const hasInitiatedWebRTC = useRef(false)

  useEffect(() => {
    if (!socket || !isConnected) return
    if (hasInitiatedWebRTC.current) return
    hasInitiatedWebRTC.current = true
    const isInitiator = sessionStorage.getItem('isInitiator') === 'true'
    initiate(isInitiator).catch((err: Error) => {
      addToast(err.message, 'error')
    })
  }, [socket, isConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fallback toast ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isUsingFallback) {
      addToast('Peer connection lost. Falling back to server relay.', 'warning')
    }
  }, [isUsingFallback]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown start ─────────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    let count = COUNTDOWN_START
    setCountdownValue(count)
    audioManager.playSound('countdown_tick')

    countdownTimerRef.current = setInterval(() => {
      count -= 1
      if (count > 0) {
        setCountdownValue(count)
        audioManager.playSound('countdown_tick')
      } else if (count === 0) {
        setCountdownValue('FIGHT!')
        audioManager.playSound('fight_start')
        clearInterval(countdownTimerRef.current!)
        countdownTimerRef.current = null
        setTimeout(() => {
          setCountdownValue(null)
          setBattleActive(true)
        }, 1000)
      }
    }, 1000)
  }, [])

  // ── Socket event subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    const handleBattleStart = () => {
      startCountdown()
    }

    const handleOpponentDisconnected = () => {
      const totalSeconds = Math.floor(RECONNECT_WINDOW_MS / 1000)
      setReconnectSeconds(totalSeconds)
      setReconnectVisible(true)

      let remaining = totalSeconds
      reconnectIntervalRef.current = setInterval(() => {
        remaining -= 1
        setReconnectSeconds(remaining)
        if (remaining <= 0) {
          clearInterval(reconnectIntervalRef.current!)
          reconnectIntervalRef.current = null
          setReconnectVisible(false)
        }
      }, 1000)
    }

    const handleOpponentReconnected = () => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current)
        reconnectIntervalRef.current = null
      }
      setReconnectVisible(false)
      addToast('Opponent reconnected!', 'success')
    }

    const handleGameEnd = (data: { winnerId: string }) => {
      setBattleActive(false)
      const isWinner = data.winnerId === localPlayerId
      audioManager.playSound(isWinner ? 'victory' : 'defeat')

      sessionStorage.setItem(
        'battleResult',
        JSON.stringify({
          winnerId: data.winnerId,
          localPlayerId,
          localHp: localPlayerState?.hp ?? 0,
          remoteHp: remotePlayerState?.hp ?? 0,
          localName: localPlayerState?.displayName ?? 'You',
          remoteName: remotePlayerState?.displayName ?? 'Opponent',
        })
      )

      setTimeout(() => {
        router.push(`/room/${roomCode}/results`)
      }, 1500)
    }

    const handleServerBroadcastForLog = (data: { event: GameEvent }) => {
      if (!data?.event) return
      setBattleEvents((prev) => [...prev.slice(-19), data.event])

      // Play sound effects based on event type
      if (data.event.type === 'attack' && data.event.power) {
        switch (data.event.power) {
          case 'fire_punch': audioManager.playSound('fire_punch_impact'); break
          case 'zap_shot': audioManager.playSound('zap_impact'); break
          case 'ice_freeze': audioManager.playSound('ice_freeze'); break
          case 'thunder_smash': audioManager.playSound('thunder_strike'); break
          case 'dragon_blast': audioManager.playSound('dragon_blast'); break
        }
      }
      if (data.event.type === 'defend') audioManager.playSound('shield_block')
      if (data.event.type === 'heal') audioManager.playSound('heal')
    }

    const handleRateLimited = () => {
      addToast('Action rate limited — wait a moment before attacking again.', 'warning')
    }

    const handleSocketError = (err: { message: string }) => {
      addToast(err?.message ?? 'Connection error. Please refresh.', 'error')
    }

    const handleRoomStateChange = (data: { state: string; localPlayerId?: string }) => {
      if (data?.state === 'battle') {
        startCountdown()
      }
    }

    const handleBattleResume = () => {
      addToast('Battle resumed!', 'info')
    }

    socket.on(SOCKET_EVENTS.ROOM_STATE_CHANGE, handleRoomStateChange)
    socket.on('battle_start', handleBattleStart)
    socket.on(SOCKET_EVENTS.OPPONENT_DISCONNECTED, handleOpponentDisconnected)
    socket.on(SOCKET_EVENTS.OPPONENT_RECONNECTED, handleOpponentReconnected)
    socket.on('game_end', handleGameEnd)
    socket.on(SOCKET_EVENTS.SERVER_BROADCAST, handleServerBroadcastForLog)
    socket.on(SOCKET_EVENTS.RATE_LIMITED, handleRateLimited)
    socket.on(SOCKET_EVENTS.ERROR, handleSocketError)
    socket.on(SOCKET_EVENTS.BATTLE_RESUME, handleBattleResume)

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_STATE_CHANGE, handleRoomStateChange)
      socket.off('battle_start', handleBattleStart)
      socket.off(SOCKET_EVENTS.OPPONENT_DISCONNECTED, handleOpponentDisconnected)
      socket.off(SOCKET_EVENTS.OPPONENT_RECONNECTED, handleOpponentReconnected)
      socket.off('game_end', handleGameEnd)
      socket.off(SOCKET_EVENTS.SERVER_BROADCAST, handleServerBroadcastForLog)
      socket.off(SOCKET_EVENTS.RATE_LIMITED, handleRateLimited)
      socket.off(SOCKET_EVENTS.ERROR, handleSocketError)
      socket.off(SOCKET_EVENTS.BATTLE_RESUME, handleBattleResume)
    }
  }, [socket, localPlayerId, localPlayerState, remotePlayerState, roomCode, router, startCountdown, addToast])

  // ── Low brightness toast ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      addToast('Your environment looks dark — move to a brighter area for better hand detection.', 'warning')
    }
    window.addEventListener('gesturebattle:lowbrightness', handler)
    return () => window.removeEventListener('gesturebattle:lowbrightness', handler)
  }, [addToast])

  // ── Gesture engine error toast ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail
      addToast(detail?.message ?? 'Gesture detection encountered an error.', 'error')
    }
    window.addEventListener('gesturebattle:engineerror', handler)
    return () => window.removeEventListener('gesturebattle:engineerror', handler)
  }, [addToast])

  // ── Cleanup timers on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
      if (reconnectIntervalRef.current) clearInterval(reconnectIntervalRef.current)
    }
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const localState = localPlayerState
  const remoteState = remotePlayerState
  const isLocalDefeated = (localState?.hp ?? 100) <= 0
  const isRemoteDefeated = (remoteState?.hp ?? 100) <= 0

  // ── Placeholder states if roomData not yet received ─────────────────────────
  const localHp = localState?.hp ?? 100
  const remoteHp = remoteState?.hp ?? 100

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        background: '#050810',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: '1fr 180px',
      }}
      className="battle-page"
    >
      <style>{`
        @media (max-width: 639px) {
          .battle-page {
            grid-template-rows: 1fr 160px !important;
          }
        }
      `}</style>

      {/* ── Background particles ─────────────────────────────────────────────── */}
      <BackgroundParticles />

      {/* ── Settings button ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        aria-label="Open settings"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 40,
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'rgba(13,17,23,0.85)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.6)',
          transition: 'color 150ms, border-color 150ms',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = '#ffffff'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(59,130,246,0.5)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
        }}
      >
        <Settings size={16} />
      </button>

      {/* ── TOP: Video tiles ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '2%',
          padding: '8px 12px 6px',
          alignItems: 'stretch',
          position: 'relative',
          zIndex: 1,
          height: '100%',
        }}
      >
        {/* Local player tile */}
        <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
          <VideoTile
            stream={localStream}
            videoRef={gestureSourceVideoRef}
            playerState={
              localState ?? {
                id: localPlayerId,
                displayName: 'You',
                hp: 100,
                maxHp: 100,
                activePower: null,
                statusEffects: [],
                statusTimers: {},
                cooldowns: {},
                unlockedPowers: ['fire_punch', 'shield', 'zap_shot', 'heal'],
                winStreak: 0,
                hasUsedFullRestore: false,
              }
            }
            isLocal={true}
            isDefeated={isLocalDefeated}
            animationState={animationState}
            landmarkData={landmarkData}
            showSkeleton={settings.showHandSkeleton}
          />
        </div>

        {/* Remote player tile */}
        <div style={{ position: 'relative', flex: '0 0 48%' }}>
          <VideoTile
            stream={remoteStream}
            playerState={
              remoteState ?? {
                id: 'remote',
                displayName: 'Opponent',
                hp: 100,
                maxHp: 100,
                activePower: null,
                statusEffects: [],
                statusTimers: {},
                cooldowns: {},
                unlockedPowers: ['fire_punch', 'shield', 'zap_shot', 'heal'],
                winStreak: 0,
                hasUsedFullRestore: false,
              }
            }
            isLocal={false}
            isDefeated={isRemoteDefeated}
            animationState={animationState}
            landmarkData={null}
            showSkeleton={false}
          />

          {/* Reconnect overlay positioned over remote tile */}
          {reconnectVisible && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
              <ReconnectOverlay isVisible={reconnectVisible} secondsRemaining={reconnectSeconds} />
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM: HUD ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#0d1117',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Row 1: Attack effect zone */}
        <AttackEffectZone
          activeProjectiles={animationState.activeProjectiles}
          localSide="local"
        />

        {/* Row 2: Power bar */}
        <PowerBar
          unlockedPowers={localState?.unlockedPowers ?? ['fire_punch', 'shield', 'zap_shot', 'heal']}
          cooldowns={localState?.cooldowns ?? {}}
          now={now}
        />

        {/* Row 3: Combo bar */}
        <ComboBar
          comboState={comboState}
          lastVoiceKeyword={lastKeyword}
          voiceLevel={voiceLevel}
          isVoiceListening={isListening && settings.voiceDetection}
        />

        {/* Row 4: Battle log */}
        <BattleLog events={battleEvents} localPlayerId={localPlayerId} />
      </div>

      {/* ── OVERLAYS ─────────────────────────────────────────────────────────── */}

      {/* Countdown overlay */}
      <CountdownOverlay count={countdownValue} />

      {/* Settings panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />

      {/* Performance mode indicator (development hint) */}
      {performanceMode !== 'full' && (
        <div
          style={{
            position: 'fixed',
            bottom: 256,
            left: 12,
            zIndex: 40,
            padding: '2px 8px',
            background: 'rgba(234,179,8,0.15)',
            border: '1px solid rgba(234,179,8,0.3)',
            borderRadius: 4,
            fontSize: 10,
            color: '#eab308',
            pointerEvents: 'none',
          }}
        >
          {performanceMode === 'minimal' ? 'Low performance mode' : 'Reduced performance mode'}
        </div>
      )}
    </div>
  )
}