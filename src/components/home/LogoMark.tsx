'use client'

export default function LogoMark() {
  return (
    <div className="flex flex-col items-center">
      <span
        style={{
          fontSize: '52px',
          fontWeight: 700,
          letterSpacing: '8px',
          color: '#ffffff',
          textTransform: 'uppercase',
          lineHeight: 1.1,
        }}
      >
        GESTURE
      </span>

      <div
        style={{
          width: '120px',
          height: '1px',
          backgroundColor: '#3b82f6',
          margin: '8px 0',
        }}
      />

      <span
        style={{
          fontSize: '52px',
          fontWeight: 700,
          letterSpacing: '8px',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          background: 'linear-gradient(to right, #3b82f6, #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: '0 0 40px rgba(59, 130, 246, 0.4)',
        }}
      >
        BATTLE
      </span>
    </div>
  )
}