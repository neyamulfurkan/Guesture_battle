'use client'

import { ReactNode } from 'react'

interface ProgressRingProps {
  progress: number
  size: number
  strokeWidth: number
  color: string
  bgColor: string
  children?: ReactNode
}

export function ProgressRing({
  progress,
  size,
  strokeWidth,
  color,
  bgColor,
  children,
}: ProgressRingProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clampedProgress)

  return (
    <div
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center"
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 100ms linear' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}