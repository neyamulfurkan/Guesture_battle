'use client'

import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type AccentColor = 'blue' | 'purple' | 'orange' | 'cyan' | 'green' | 'red' | 'gold' | 'gray'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: ButtonVariant
  accentColor?: AccentColor
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  children?: ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

const COLOR_MAP: Record<AccentColor, { hex: string; glow: string }> = {
  blue:   { hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.5)' },
  purple: { hex: '#a855f7', glow: 'rgba(168, 85, 247, 0.5)' },
  orange: { hex: '#f97316', glow: 'rgba(249, 115, 22, 0.5)' },
  cyan:   { hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.5)' },
  green:  { hex: '#22c55e', glow: 'rgba(34, 197, 94, 0.5)' },
  red:    { hex: '#ef4444', glow: 'rgba(239, 68, 68, 0.5)' },
  gold:   { hex: '#eab308', glow: 'rgba(234, 179, 8, 0.5)' },
  gray:   { hex: '#94a3b8', glow: 'rgba(148, 163, 184, 0.5)' },
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

export function Button({
  variant = 'primary',
  accentColor = 'blue',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const { hex, glow } = COLOR_MAP[accentColor]

  const isInert = disabled || loading

  const baseClasses = [
    'inline-flex items-center justify-center gap-2 rounded-lg font-bold',
    'border transition-all duration-150 select-none',
    'focus-visible:outline-none focus-visible:ring-2',
    SIZE_CLASSES[size],
    isInert ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
  ].join(' ')

  const variantClasses: Record<ButtonVariant, string> = {
    primary:   'bg-[#1a2035] text-white hover:-translate-y-[1px] active:translate-y-[1px]',
    secondary: 'bg-transparent text-white hover:-translate-y-[1px] active:translate-y-[1px]',
    danger:    'bg-[#1a0a0a] text-white hover:-translate-y-[1px] active:translate-y-[1px]',
    ghost:     'bg-transparent border-transparent text-white hover:-translate-y-[1px] active:translate-y-[1px]',
  }

  const borderStyle = variant === 'ghost'
    ? {}
    : { borderColor: hex }

  const hoverGlowStyle = {
    '--btn-glow': `0 0 8px ${glow}, 0 0 20px ${glow}, 0 0 40px ${glow}`,
  } as React.CSSProperties

  return (
    <button
      type={type}
      disabled={isInert}
      onClick={isInert ? undefined : onClick}
      className={[baseClasses, variantClasses[variant], className].join(' ')}
      style={{
        ...borderStyle,
        ...hoverGlowStyle,
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={e => {
        if (!isInert && variant !== 'ghost') {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            `0 0 8px ${glow}, 0 0 20px ${glow}, 0 0 40px ${glow}`
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
      }}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} className="animate-spin" />
      ) : (
        children
      )}
    </button>
  )
}