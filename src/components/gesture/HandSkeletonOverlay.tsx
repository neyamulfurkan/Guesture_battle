'use client'

import { useRef, useEffect, useState } from 'react'
import type { HandsResults } from '@/types/mediapipe.d'

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

interface HandSkeletonOverlayProps {
  landmarkData: HandsResults | null
  videoWidth: number
  videoHeight: number
  nativeVideoWidth?: number
  nativeVideoHeight?: number
  enabled: boolean
  isLocalMirrored?: boolean
  activeGestureName?: string | null
}

function getCoverTransform(
  containerW: number,
  containerH: number,
  videoNativeW: number,
  videoNativeH: number
): { scaleX: number; scaleY: number; offsetX: number; offsetY: number } {
  const containerAspect = containerW / containerH
  const videoAspect = videoNativeW / videoNativeH
  let drawW: number, drawH: number
  if (videoAspect > containerAspect) {
    // video wider than container — crop sides
    drawH = containerH
    drawW = videoNativeW * (containerH / videoNativeH)
  } else {
    // video taller than container — crop top/bottom
    drawW = containerW
    drawH = videoNativeH * (containerW / videoNativeW)
  }
  const offsetX = (containerW - drawW) / 2
  const offsetY = (containerH - drawH) / 2
  return { scaleX: drawW / videoNativeW, scaleY: drawH / videoNativeH, offsetX, offsetY }
}

export default function HandSkeletonOverlay({
  landmarkData,
  videoWidth,
  videoHeight,
  nativeVideoWidth,
  nativeVideoHeight,
  enabled,
  isLocalMirrored = false,
  activeGestureName = null,
}: HandSkeletonOverlayProps) {
  const videoNativeW = nativeVideoWidth ?? 640
  const videoNativeH = nativeVideoHeight ?? 480
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!enabled || !landmarkData || landmarkData.multiHandLandmarks.length === 0) return

    for (const landmarks of landmarkData.multiHandLandmarks) {
      ctx.save()

      const { scaleX, scaleY, offsetX, offsetY } = getCoverTransform(videoWidth, videoHeight, videoNativeW, videoNativeH)

      const mapX = (nx: number) => {
        const raw = nx * videoNativeW * scaleX + offsetX
        return isLocalMirrored ? videoWidth - raw : raw
      }
      const mapY = (ny: number) => ny * videoNativeH * scaleY + offsetY

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
      ctx.lineWidth = 1

      for (const [start, end] of HAND_CONNECTIONS) {
        const a = landmarks[start]
        const b = landmarks[end]
        if (!a || !b) continue
        ctx.beginPath()
        ctx.moveTo(mapX(a.x), mapY(a.y))
        ctx.lineTo(mapX(b.x), mapY(b.y))
        ctx.stroke()
      }

      ctx.fillStyle = '#3b82f6'
      for (const lm of landmarks) {
        ctx.beginPath()
        ctx.arc(mapX(lm.x), mapY(lm.y), 4, 0, Math.PI * 2)
        ctx.fill()
      }

      // Draw gesture label — cinematic floating badge above the hand
      // Also draw power effect glow directly on the hand landmarks
      if (activeGestureName) {
        // Determine color by gesture/power
        const gestureColorMap: Record<string, string> = {
          '🔥 Fire Punch': '#f97316',
          '🛡️ Shield': '#06b6d4',
          '⚡ Zap Shot': '#facc15',
          '💚 Heal': '#22c55e',
          '❄️ Ice Freeze': '#bae6fd',
          '💨 Force Push': '#a855f7',
          '🌀 Full Restore': '#22c55e',
          '🔮 Reflect': '#a855f7',
        }
        const effectColor = gestureColorMap[activeGestureName] ?? '#3b82f6'

        // Draw glow on each landmark dot
        ctx.save()
        for (const lm of landmarks) {
          const lx = mapX(lm.x)
          const ly = mapY(lm.y)
          ctx.beginPath()
          ctx.arc(lx, ly, 7, 0, Math.PI * 2)
          ctx.fillStyle = effectColor
          ctx.globalAlpha = 0.35
          ctx.shadowColor = effectColor
          ctx.shadowBlur = 14
          ctx.fill()
        }
        // Draw glowing connections
        ctx.strokeStyle = effectColor
        ctx.lineWidth = 2.5
        ctx.globalAlpha = 0.55
        ctx.shadowColor = effectColor
        ctx.shadowBlur = 12
        for (const [start, end] of HAND_CONNECTIONS) {
          const a = landmarks[start]
          const b = landmarks[end]
          if (!a || !b) continue
          ctx.beginPath()
          ctx.moveTo(mapX(a.x), mapY(a.y))
          ctx.lineTo(mapX(b.x), mapY(b.y))
          ctx.stroke()
        }
        ctx.restore()
      }

      if (activeGestureName) {
        const wrist = landmarks[0]
        const indexMcp = landmarks[5]
        const middleMcp = landmarks[9]
        const pinkyMcp = landmarks[17]
        if (wrist && middleMcp && indexMcp && pinkyMcp) {
          const now = performance.now()

          // Anchor label to center of the palm, floating above wrist
          const labelX = mapX(middleMcp.x)
          // Position above the topmost MCP to clear the hand
          const topY = Math.min(mapY(indexMcp.y), mapY(middleMcp.y), mapY(pinkyMcp.y))
          const labelCenterY = topY - 48

          ctx.save()

          const label = activeGestureName
          const fontSize = 16
          ctx.font = `bold ${fontSize}px "Inter", sans-serif`
          const textWidth = ctx.measureText(label).width
          const padX = 16
          const padY = 8
          const boxW = textWidth + padX * 2
          const boxH = fontSize + padY * 2
          const boxX = labelX - boxW / 2
          const boxY = labelCenterY - boxH / 2
          const radius = boxH / 2

          // Outer glow ring
          ctx.shadowColor = '#3b82f6'
          ctx.shadowBlur = 24
          ctx.strokeStyle = 'rgba(59,130,246,0.5)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(boxX + radius, boxY - 3)
          ctx.lineTo(boxX + boxW - radius, boxY - 3)
          ctx.quadraticCurveTo(boxX + boxW + 3, boxY - 3, boxX + boxW + 3, boxY + radius)
          ctx.lineTo(boxX + boxW + 3, boxY + boxH - radius)
          ctx.quadraticCurveTo(boxX + boxW + 3, boxY + boxH + 3, boxX + boxW - radius, boxY + boxH + 3)
          ctx.lineTo(boxX + radius, boxY + boxH + 3)
          ctx.quadraticCurveTo(boxX - 3, boxY + boxH + 3, boxX - 3, boxY + boxH - radius)
          ctx.lineTo(boxX - 3, boxY + radius)
          ctx.quadraticCurveTo(boxX - 3, boxY - 3, boxX + radius, boxY - 3)
          ctx.closePath()
          ctx.stroke()

          // Background pill — dark with subtle blue tint
          ctx.shadowBlur = 0
          const grad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH)
          grad.addColorStop(0, 'rgba(10, 16, 40, 0.94)')
          grad.addColorStop(1, 'rgba(5, 8, 20, 0.94)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.moveTo(boxX + radius, boxY)
          ctx.lineTo(boxX + boxW - radius, boxY)
          ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius)
          ctx.lineTo(boxX + boxW, boxY + boxH - radius)
          ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH)
          ctx.lineTo(boxX + radius, boxY + boxH)
          ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius)
          ctx.lineTo(boxX, boxY + radius)
          ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY)
          ctx.closePath()
          ctx.fill()

          // Border
          ctx.strokeStyle = 'rgba(59,130,246,0.9)'
          ctx.lineWidth = 1.5
          ctx.shadowColor = '#3b82f6'
          ctx.shadowBlur = 10
          ctx.stroke()

          // Shimmer sweep — animated highlight stripe
          const shimmerProgress = (now % 1600) / 1600
          const shimmerX = boxX + shimmerProgress * (boxW + 40) - 20
          const shimmerGrad = ctx.createLinearGradient(shimmerX - 20, 0, shimmerX + 20, 0)
          shimmerGrad.addColorStop(0, 'rgba(255,255,255,0)')
          shimmerGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)')
          shimmerGrad.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = shimmerGrad
          ctx.beginPath()
          ctx.moveTo(boxX + radius, boxY)
          ctx.lineTo(boxX + boxW - radius, boxY)
          ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius)
          ctx.lineTo(boxX + boxW, boxY + boxH - radius)
          ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH)
          ctx.lineTo(boxX + radius, boxY + boxH)
          ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius)
          ctx.lineTo(boxX, boxY + radius)
          ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY)
          ctx.closePath()
          ctx.fill()

          // Text with glow
          ctx.shadowColor = '#93c5fd'
          ctx.shadowBlur = 8
          ctx.fillStyle = '#ffffff'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = `bold ${fontSize}px "Inter", sans-serif`
          ctx.fillText(label, labelX, labelCenterY)

          // Connector line from label to hand center
          const handCenterY = mapY(middleMcp.y)
          if (handCenterY > labelCenterY + boxH / 2 + 4) {
            ctx.shadowBlur = 0
            ctx.strokeStyle = 'rgba(59,130,246,0.35)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 4])
            ctx.beginPath()
            ctx.moveTo(labelX, labelCenterY + boxH / 2)
            ctx.lineTo(mapX(middleMcp.x), handCenterY - 8)
            ctx.stroke()
            ctx.setLineDash([])
          }

          ctx.restore()
        }
      }

      ctx.restore()
    }
  }, [landmarkData, videoWidth, videoHeight, enabled, isLocalMirrored, videoNativeW, videoNativeH, activeGestureName])

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}