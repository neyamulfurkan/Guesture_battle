'use client'

import { ElementType } from 'react'

interface FeatureBadgeProps {
  icon: ElementType
  label: string
  accentColor: string
}

export function FeatureBadge({ icon: Icon, label, accentColor }: FeatureBadgeProps) {
  return (
    <div
      style={{
        width: '160px',
        backgroundColor: '#111827',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '8px 16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <Icon size={16} style={{ color: accentColor, flexShrink: 0 }} />
      <span
        style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.7)',
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
    </div>
  )
}