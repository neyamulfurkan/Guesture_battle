'use client'

import { useEffect, useRef } from 'react'

export function VSBadge() {
  const borderRef = useRef<HTMLDivElement>(null)

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
        width: 64,
        height: 64,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          padding: 2,
          background: 'conic-gradient(#3b82f6, #a855f7, #f97316, #3b82f6)',
          animation: 'vs-border-spin 3s linear infinite',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: '#0a0a0a',
          }}
        />
      </div>
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 22,
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.05em',
          userSelect: 'none',
        }}
      >
        VS
      </span>
      <style>{`
        @keyframes vs-border-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}