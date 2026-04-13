'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'
import {
  HP_LOW_THRESHOLD,
  HP_CRITICAL_VIGNETTE_THRESHOLD,
} from '@/lib/gameConstants'
import type { AnimationState, PlayerState, GestureId } from '@/types/game'
import type { HandsResults } from '@/types/mediapipe.d'
import HandSkeletonOverlay from '@/components/gesture/HandSkeletonOverlay'
import { GestureIndicator } from '@/components/gesture/GestureIndicator'
import { HPBar } from '@/components/battle/HPBar'
import { StatusBadges } from '@/components/battle/StatusBadges'
import { PillBadge } from '@/components/ui/Badge'
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer'

interface VideoTileProps {
  stream: MediaStream | null
  videoRef?: React.RefObject<HTMLVideoElement>
  playerState: PlayerState
  isLocal: boolean
  isDefeated: boolean
  animationState: AnimationState
  landmarkData: HandsResults | null
  showSkeleton: boolean
  lastConfirmedGesture?: { gestureId: GestureId; palmX: number; palmY: number; time: number } | null
}

const GESTURE_DISPLAY_NAMES: Record<GestureId, string> = {
  fist: '🔥 Fire Punch',
  open_palm: '🛡️ Shield',
  index_point: '⚡ Zap Shot',
  shaka: '💚 Heal',
  peace_sign: '❄️ Ice Freeze',
  both_hands_push: '💨 Force Push',
  both_hands_open: '🌀 Full Restore',
  wrist_spin: '🔮 Reflect',
  thumbs_up: '👍 Power Up',
  thumbs_down: '👎 Forfeit',
  flat_palm: '🌊 Wave',
  crossed_fingers: '✖️ Double Strike',
  swipe_left: '⬅️ Dodge Left',
  swipe_right: '➡️ Dodge Right',
}

const GESTURE_SHOW_DURATION_MS = 2200

export default function VideoTile({
  stream,
  videoRef: externalVideoRef,
  playerState,
  isLocal,
  isDefeated,
  animationState,
  landmarkData,
  showSkeleton,
  lastConfirmedGesture = null,
}: VideoTileProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null)
  const videoRef = externalVideoRef ?? internalVideoRef
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tileDimensions, setTileDimensions] = useState({ width: 640, height: 480 })
  const [nativeVideoDimensions, setNativeVideoDimensions] = useState({ width: 640, height: 480 })
  const [displayedGestureName, setDisplayedGestureName] = useState<string | null>(null)
  const gestureDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setTileDimensions({ width: Math.round(width), height: Math.round(height) })
        }
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // Show gesture name overlay — always show for local, pass-through for remote display
  useEffect(() => {
    if (!lastConfirmedGesture) return
    const name = GESTURE_DISPLAY_NAMES[lastConfirmedGesture.gestureId] ?? lastConfirmedGesture.gestureId
    setDisplayedGestureName(name)
    if (gestureDisplayTimerRef.current) clearTimeout(gestureDisplayTimerRef.current)
    gestureDisplayTimerRef.current = setTimeout(() => {
      setDisplayedGestureName(null)
    }, GESTURE_SHOW_DURATION_MS)
    return () => {
      if (gestureDisplayTimerRef.current) clearTimeout(gestureDisplayTimerRef.current)
    }
  }, [lastConfirmedGesture])

  const playerColor = isLocal ? '#3b82f6' : '#f97316'
  const isLowHp = playerState.hp <= HP_LOW_THRESHOLD
  const isCriticalHp = playerState.hp <= HP_CRITICAL_VIGNETTE_THRESHOLD

  useCanvasRenderer(canvasRef, animationState, null, isLocal ? 'local' : 'remote')

  // Attach MediaStream to video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (stream) {
      video.srcObject = stream
      video.play().catch(() => {
        // Autoplay may be blocked; silently ignore
      })
      const onLoadedMetadata = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setNativeVideoDimensions({ width: video.videoWidth, height: video.videoHeight })
        }
      }
      video.addEventListener('loadedmetadata', onLoadedMetadata)
      // In case metadata already loaded
      if (video.videoWidth > 0) onLoadedMetadata()
      return () => video.removeEventListener('loadedmetadata', onLoadedMetadata)
    } else {
      video.srcObject = null
    }
  }, [stream])

  // Prevent iOS scroll on canvas touch
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchStart, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchStart)
    }
  }, [handleTouchStart])

  // Expose video element ref so parent / gesture engine can access it
  // via a data attribute for selection
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.dataset.playerId = playerState.id
    video.dataset.isLocal = String(isLocal)
  }, [playerState.id, isLocal])

  const borderColor = isDefeated
    ? 'rgba(148,163,184,0.3)'
    : isLowHp
    ? '#ef4444'
    : `${playerColor}66`

  const borderAnimation = isLowHp && !isDefeated ? 'glow-pulse 600ms ease-in-out infinite' : undefined

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        border: `2px solid ${borderColor}`,
        animation: borderAnimation,
        boxShadow: isDefeated
          ? 'none'
          : isLowHp
          ? '0 0 16px 2px rgba(239,68,68,0.45), 0 0 4px 1px rgba(239,68,68,0.3)'
          : `0 0 12px 1px ${playerColor}33`,
        flexShrink: 0,
        background: '#0d1117',
        filter: isDefeated ? 'grayscale(100%)' : undefined,
      }}
    >
      {/* ── Video ── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isLocal ? 'scaleX(-1)' : undefined,
          display: 'block',
        }}
      />

      {/* ── Hand skeleton overlay ── */}
      {/* Always render skeleton overlay so gesture label shows even when skeleton dots are off */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        <HandSkeletonOverlay
          landmarkData={landmarkData}
          videoWidth={tileDimensions.width}
          videoHeight={tileDimensions.height}
          nativeVideoWidth={nativeVideoDimensions.width}
          nativeVideoHeight={nativeVideoDimensions.height}
          enabled={showSkeleton && !isDefeated}
          isLocalMirrored={isLocal}
          activeGestureName={!isDefeated ? displayedGestureName : null}
        />
      </div>

      {/* ── Effect canvas ── */}
      <canvas
        ref={canvasRef}
        width={tileDimensions.width}
        height={tileDimensions.height}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          touchAction: 'none',
        }}
      />

      {/* ── Critical HP vignette ── */}
      {isCriticalHp && !isDefeated && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse at center, transparent 55%, rgba(239,68,68,0.22) 100%)',
          }}
        />
      )}

      {/* ── HP Bar ── */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <HPBar
          currentHp={playerState.hp}
          maxHp={100}
          playerColor={playerColor}
          side={isLocal ? 'local' : 'remote'}
        />
      </div>

      {/* ── Status badges ── */}
      {playerState.statusEffects.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 52,
            left: 12,
            right: 12,
            zIndex: 10,
          }}
        >
          <StatusBadges statusEffects={playerState.statusEffects} />
        </div>
      )}

      {/* ── Player name ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 10,
        }}
      >
        <PillBadge
          label={playerState.displayName}
          color={isLocal ? 'blue' : 'orange'}
          size="sm"
        />
      </div>

      {/* ── Gesture indicator (local only) ── */}
      {isLocal && (
        <GestureIndicator
          isDetecting={!isDefeated && !!stream}
          isHandDetected={
            !isDefeated &&
            !!landmarkData &&
            landmarkData.multiHandLandmarks.length > 0
          }
        />
      )}

      {/* ── Defeat overlay ── */}
      {isDefeated && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            gap: 12,
          }}
        >
          {/* Skull SVG */}
          <svg
            width={80}
            height={80}
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ opacity: 0.3 }}
          >
            <ellipse cx="40" cy="35" rx="26" ry="24" fill="white" />
            <rect x="22" y="54" width="36" height="14" rx="4" fill="white" />
            {/* Eye sockets */}
            <ellipse cx="31" cy="34" rx="7" ry="7" fill="#050810" />
            <ellipse cx="49" cy="34" rx="7" ry="7" fill="#050810" />
            {/* Nose */}
            <ellipse cx="40" cy="46" rx="3.5" ry="3" fill="#050810" />
            {/* Teeth gaps */}
            <rect x="28" y="54" width="4" height="8" rx="1" fill="#050810" />
            <rect x="36" y="54" width="4" height="8" rx="1" fill="#050810" />
            <rect x="44" y="54" width="4" height="8" rx="1" fill="#050810" />
          </svg>

          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#ef4444',
              letterSpacing: 4,
              textShadow: '0 0 20px rgba(239,68,68,0.6)',
            }}
          >
            DEFEATED
          </span>
        </div>
      )}
    </div>
  )
}