'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

interface CodeInputProps {
  onSubmit: (code: string) => Promise<void>
  error: string | null
  isLoading: boolean
}

export function CodeInput({ onSubmit, error, isLoading }: CodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [displayValue, setDisplayValue] = useState('')
  const [borderColor, setBorderColor] = useState('#3b82f6')
  const [borderGlow, setBorderGlow] = useState('0 0 8px rgba(59,130,246,0.4), 0 0 20px rgba(59,130,246,0.2)')
  const errorFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Flash red border on error
  useEffect(() => {
    if (error) {
      setBorderColor('#ef4444')
      setBorderGlow('0 0 8px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.3)')
      if (errorFlashRef.current) clearTimeout(errorFlashRef.current)
      errorFlashRef.current = setTimeout(() => {
        setBorderColor('#3b82f6')
        setBorderGlow('0 0 8px rgba(59,130,246,0.4), 0 0 20px rgba(59,130,246,0.2)')
      }, 1500)
    }
    return () => {
      if (errorFlashRef.current) clearTimeout(errorFlashRef.current)
    }
  }, [error])

  function formatCode(raw: string): string {
    // Strip non-alphanumeric, uppercase, max 6 chars
    const clean = raw.replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (clean.length <= 2) return clean
    return clean.slice(0, 2) + '-' + clean.slice(2)
  }

  function getRawCode(formatted: string): string {
    return formatted.replace(/-/g, '')
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.toUpperCase()
    const formatted = formatCode(raw.replace(/-/g, ''))
    setDisplayValue(formatted)
    // Reset border to blue on new input
    if (borderColor === '#ef4444') {
      setBorderColor('#3b82f6')
      setBorderGlow('0 0 8px rgba(59,130,246,0.4), 0 0 20px rgba(59,130,246,0.2)')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSubmit()
    }
    // Allow backspace to work correctly with hyphen
    if (e.key === 'Backspace') {
      const raw = getRawCode(displayValue)
      if (raw.length === 3) {
        // Prevent default so we can manually strip the last raw char
        e.preventDefault()
        const newRaw = raw.slice(0, 2)
        setDisplayValue(formatCode(newRaw))
      }
    }
  }

  async function handleSubmit() {
    const raw = getRawCode(displayValue)
    if (raw.length < 6) {
      setBorderColor('#ef4444')
      setBorderGlow('0 0 8px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.3)')
      inputRef.current?.focus()
      return
    }
    await onSubmit(raw)
    // If error was set by parent, input clears and refocuses
    if (error) {
      setDisplayValue('')
      inputRef.current?.focus()
    }
  }

  // Clear and refocus on new error from parent
  useEffect(() => {
    if (error) {
      setDisplayValue('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [error])

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: 320 }}>
      {/* Code input field */}
      <div style={{ width: 320, position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={7} // XX-NNNN = 7 chars with hyphen
          placeholder="Enter room code"
          disabled={isLoading}
          style={{
            width: '100%',
            height: 64,
            background: '#0d1117',
            border: `2px solid ${borderColor}`,
            boxShadow: borderGlow,
            borderRadius: 8,
            fontFamily: 'monospace',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 8,
            color: 'white',
            textAlign: 'center',
            outline: 'none',
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
            opacity: isLoading ? 0.5 : 1,
            cursor: isLoading ? 'not-allowed' : 'text',
          }}
          className="placeholder:text-white/30 placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
        />
      </div>

      {/* Error message */}
      <div
        style={{
          minHeight: 20,
          width: '100%',
          textAlign: 'center',
          transition: 'opacity 200ms ease',
          opacity: error ? 1 : 0,
        }}
      >
        {error && (
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 400 }}>
            {error}
          </span>
        )}
      </div>

      {/* Join button */}
      <Button
        variant="primary"
        accentColor="blue"
        size="lg"
        loading={isLoading}
        disabled={isLoading}
        onClick={handleSubmit}
        className="w-full justify-center"
        style={{ width: 320, height: 52 } as React.CSSProperties}
      >
        Join Battle →
      </Button>
    </div>
  )
}