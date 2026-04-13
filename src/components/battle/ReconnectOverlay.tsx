'use client'

import { Wifi } from 'lucide-react'

interface ReconnectOverlayProps {
  isVisible: boolean
  secondsRemaining: number
}

export function ReconnectOverlay({ isVisible, secondsRemaining }: ReconnectOverlayProps) {
  if (!isVisible) return null

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center rounded-xl z-20"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <Wifi size={24} className="text-gray-400 animate-pulse mb-3" />
      <p className="text-white text-sm font-medium">
        Reconnecting... ({secondsRemaining}s)
      </p>
    </div>
  )
}