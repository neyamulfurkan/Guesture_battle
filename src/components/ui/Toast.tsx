'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { create } from 'zustand'
import type { ToastMessage } from '@/types/game'

// ─── ZUSTAND STORE ────────────────────────────────────────────────────────────

interface ToastStore {
  toasts: ToastMessage[]
  addToast: (message: string, type: ToastMessage['type'], duration?: number) => void
  removeToast: (id: string) => void
}

const MAX_TOASTS = 4

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set((state) => {
      const next = [...state.toasts, { id, message, type, duration }]
      return { toasts: next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next }
    })
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))

export function useToast() {
  const { toasts, addToast, removeToast } = useToastStore()
  return { toasts, addToast, removeToast }
}

// ─── COLOR MAP ────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<ToastMessage['type'], { border: string; icon: string }> = {
  info:    { border: '#3b82f6', icon: '#3b82f6' },
  success: { border: '#22c55e', icon: '#22c55e' },
  warning: { border: '#eab308', icon: '#eab308' },
  error:   { border: '#ef4444', icon: '#ef4444' },
}

// ─── SINGLE TOAST ─────────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: ToastMessage
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => onRemove(toast.id), 300)
  }

  useEffect(() => {
    // Trigger slide-in on next tick
    const enterFrame = requestAnimationFrame(() => {
      setVisible(true)
    })

    timerRef.current = setTimeout(() => {
      dismiss()
    }, toast.duration)

    return () => {
      cancelAnimationFrame(enterFrame)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { border } = TYPE_STYLES[toast.type]

  const translateClass = leaving
    ? 'translate-x-full opacity-0'
    : visible
    ? 'translate-x-0 opacity-100'
    : 'translate-x-full opacity-0'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'flex items-start gap-3 min-w-[280px] max-w-[360px] rounded-lg',
        'bg-[#0d1117] shadow-xl transition-all duration-300 ease-out overflow-hidden',
        translateClass,
      ].join(' ')}
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(255,255,255,0.08)',
        borderLeftWidth: '3px',
        borderLeftColor: border,
      }}
    >
      <p
        className="flex-1 py-3 pl-3 text-[13px] leading-snug text-white/90 font-400"
        style={{ fontWeight: 400 }}
      >
        {toast.message}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notification"
        className="flex-shrink-0 mt-2.5 mr-2.5 p-0.5 rounded text-white/40 hover:text-white/80 transition-colors duration-150"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── CONTAINER ────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none"
      style={{ zIndex: 9999 }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  )
}