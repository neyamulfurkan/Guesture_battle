'use client'

interface GestureIndicatorProps {
  isDetecting: boolean
  isHandDetected: boolean
}

export function GestureIndicator({ isDetecting, isHandDetected }: GestureIndicatorProps) {
  return (
    <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none">
      {/* Gesture detection active dot */}
      <div
        className="flex items-center gap-1.5"
        style={{ opacity: isDetecting ? 1 : 0.5 }}
      >
        <span
          className="animate-pulse rounded-full"
          style={{
            width: 8,
            height: 8,
            backgroundColor: '#22c55e',
            boxShadow: isDetecting ? '0 0 6px #22c55e' : 'none',
          }}
        />
      </div>

      {/* Hand detected icon with checkmark */}
      <div
        className="relative"
        style={{ opacity: isHandDetected ? 1 : 0.5 }}
      >
        {/* Hand silhouette SVG */}
        <svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Palm */}
          <path
            d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-5.5a1.5 1.5 0 0 1 3 0V12m0-4a1.5 1.5 0 0 1 3 0v5M8 13a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V8.5"
            stroke="white"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />
          <path
            d="M8 13V9.5a1.5 1.5 0 0 0-3 0V14a7 7 0 0 0 7 7h1"
            stroke="white"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />
        </svg>

        {/* Checkmark overlay when hand detected */}
        {isHandDetected && (
          <div
            className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
            style={{
              width: 12,
              height: 12,
              backgroundColor: '#22c55e',
              boxShadow: '0 0 4px #22c55e',
            }}
          >
            <svg
              width={8}
              height={8}
              viewBox="0 0 8 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1.5 4L3 5.5L6.5 2"
                stroke="white"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}