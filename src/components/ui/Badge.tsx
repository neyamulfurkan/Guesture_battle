'use client'

type AccentColor = 'blue' | 'purple' | 'orange' | 'cyan' | 'green' | 'red' | 'gold' | 'gray'
type BadgeSize = 'sm' | 'md'

const COLOR_MAP: Record<AccentColor, { hex: string; bg: string }> = {
  blue:   { hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' },
  purple: { hex: '#a855f7', bg: 'rgba(168, 85, 247, 0.2)' },
  orange: { hex: '#f97316', bg: 'rgba(249, 115, 22, 0.2)' },
  cyan:   { hex: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)' },
  green:  { hex: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)' },
  red:    { hex: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
  gold:   { hex: '#eab308', bg: 'rgba(234, 179, 8, 0.2)' },
  gray:   { hex: '#94a3b8', bg: 'rgba(148, 163, 184, 0.2)' },
}

interface BadgeProps {
  label: string
  color?: AccentColor
  size?: BadgeSize
  className?: string
}

interface PillBadgeProps {
  label: string
  color?: AccentColor
  size?: BadgeSize
  className?: string
}

export function Badge({ label, color = 'blue', size = 'md', className = '' }: BadgeProps) {
  const { hex, bg } = COLOR_MAP[color]

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-[11px]'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-bold border select-none',
        sizeClasses,
        className,
      ].join(' ')}
      style={{
        backgroundColor: bg,
        borderColor: hex,
        color: hex,
      }}
    >
      {label}
    </span>
  )
}

export function PillBadge({ label, color = 'gray', size = 'md', className = '' }: PillBadgeProps) {
  const { hex, bg } = COLOR_MAP[color]

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-3 py-1 text-[11px]'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-bold border select-none whitespace-nowrap',
        sizeClasses,
        className,
      ].join(' ')}
      style={{
        backgroundColor: bg,
        borderColor: hex,
        color: hex,
      }}
    >
      {label}
    </span>
  )
}