'use client'

import { useRef, useEffect } from 'react'
import type { HandsResults } from '@/types/mediapipe.d'
import HandSkeletonOverlay from '@/components/gesture/HandSkeletonOverlay'
import { GestureIndicator } from '@/components/gesture/GestureIndicator'

interface CameraPreviewProps {
  stream: MediaStream | null
  landmarkData: HandsResults | null
  showSkeleton: boolean
  isHandDetected: boolean
  size: 'sm' | 'md'
}

const SIZE_MAP = {
  sm: { width: 160, height: 120 },
  md: { width: 320, height: 240 },
}

export default function CameraPreview({
  stream,
  landmarkData,
  showSkeleton,
  isHandDetected,
  size,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { width, height } = SIZE_MAP[size]

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (stream) {
      video.srcObject = stream
      video.play().catch(() => {})
    } else {
      video.srcObject = null
    }
  }, [stream])

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          width,
          height,
          backgroundColor: '#0d1117',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <video
          ref={videoRef}
          width={width}
          height={height}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            display: 'block',
          }}
        />

        {showSkeleton && (
          <HandSkeletonOverlay
            landmarkData={landmarkData}
            videoWidth={width}
            videoHeight={height}
            nativeVideoWidth={640}
            nativeVideoHeight={480}
            enabled={showSkeleton}
            isLocalMirrored={true}
          />
        )}

        <GestureIndicator
          isDetecting={stream !== null}
          isHandDetected={isHandDetected}
        />
      </div>

      {isHandDetected && (
        <p
          style={{
            fontSize: 13,
            color: '#22c55e',
            margin: 0,
            textShadow: '0 0 8px rgba(34,197,94,0.5)',
          }}
        >
          Hand detected!
        </p>
      )}
    </div>
  )
}