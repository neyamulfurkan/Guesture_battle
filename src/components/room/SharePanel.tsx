'use client'

import { useState, useRef } from 'react'
import { Copy, MessageCircle, Link, MessageSquare, ChevronDown, ChevronUp, Send, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface SharePanelProps {
  roomCode: string
  onExpand?: () => void
}

export function SharePanel({ roomCode, onExpand }: SharePanelProps) {
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [contactsExpanded, setContactsExpanded] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const linkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const formattedCode = roomCode.length === 6
    ? `${roomCode.slice(0, 2)}-${roomCode.slice(2)}`
    : roomCode

  const shareText = `Join my GestureBattle! Room code: ${formattedCode}`
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/room/${roomCode}`
    : ''

  function handleCopyCode() {
    navigator.clipboard.writeText(formattedCode).then(() => {
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopied(true)
      if (linkTimeoutRef.current) clearTimeout(linkTimeoutRef.current)
      linkTimeoutRef.current = setTimeout(() => setLinkCopied(false), 1500)
    })
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank')
  }

  function handleSMS() {
    window.open(`sms:?body=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_self')
  }

  function handleMessenger() {
    window.open(`https://m.me/?link=${encodeURIComponent(shareUrl)}`, '_blank')
  }

  function handleTelegram() {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank')
  }

  function handleEmail() {
    window.open(`mailto:?subject=${encodeURIComponent('GestureBattle Challenge!')}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`, '_self')
  }

  function toggleContacts() {
    setContactsExpanded(prev => !prev)
    onExpand?.()
  }

  return (
    <div className="flex flex-col items-center w-full gap-6">
      {/* Room Code Display */}
      <div className="flex flex-col items-center gap-2">
        <p
          className="font-bold tracking-[12px] text-center select-all"
          style={{
            fontSize: '40px',
            color: '#3b82f6',
            textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)',
          }}
        >
          {formattedCode}
        </p>
        <p className="text-[13px] text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Share this code with your opponent
        </p>
      </div>

      {/* 2×2 Share Button Grid */}
      <div
        className="grid grid-cols-2 gap-3"
        style={{ width: '416px', maxWidth: '100%' }}
      >
        {/* Copy Code */}
        <button
          onClick={handleCopyCode}
          className="flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all duration-150 cursor-pointer"
          style={{
            height: '52px',
            background: '#1a2035',
            border: `1px solid ${copied ? '#22c55e' : '#3b82f6'}`,
            color: copied ? '#22c55e' : 'white',
            boxShadow: copied
              ? '0 0 8px rgba(34,197,94,0.4), 0 0 20px rgba(34,197,94,0.2)'
              : undefined,
          }}
        >
          <Copy size={16} />
          {copied ? 'Copied!' : 'Copy Code'}
        </button>

        {/* Share on WhatsApp */}
        <button
          onClick={handleWhatsApp}
          className="flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all duration-150 cursor-pointer hover:-translate-y-px"
          style={{
            height: '52px',
            background: '#1a2035',
            border: '1px solid #22c55e',
            color: 'white',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 0 8px rgba(34,197,94,0.4), 0 0 20px rgba(34,197,94,0.2)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
          }}
        >
          <MessageCircle size={16} />
          WhatsApp
        </button>

        {/* Share Link */}
        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all duration-150 cursor-pointer hover:-translate-y-px"
          style={{
            height: '52px',
            background: '#1a2035',
            border: `1px solid ${linkCopied ? '#22c55e' : '#a855f7'}`,
            color: linkCopied ? '#22c55e' : 'white',
            boxShadow: linkCopied
              ? '0 0 8px rgba(34,197,94,0.4), 0 0 20px rgba(34,197,94,0.2)'
              : undefined,
          }}
          onMouseEnter={e => {
            if (!linkCopied) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 8px rgba(168,85,247,0.4), 0 0 20px rgba(168,85,247,0.2)'
            }
          }}
          onMouseLeave={e => {
            if (!linkCopied) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
            }
          }}
        >
          <Link size={16} />
          {linkCopied ? 'Copied!' : 'Share Link'}
        </button>

        {/* Send via SMS */}
        <button
          onClick={handleSMS}
          className="flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all duration-150 cursor-pointer hover:-translate-y-px"
          style={{
            height: '52px',
            background: '#1a2035',
            border: '1px solid #06b6d4',
            color: 'white',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 0 8px rgba(6,182,212,0.4), 0 0 20px rgba(6,182,212,0.2)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
          }}
        >
          <MessageSquare size={16} />
          Send via SMS
        </button>
      </div>

      {/* Collapsible Contacts Section */}
      <div className="w-full" style={{ maxWidth: '416px' }}>
        <button
          onClick={toggleContacts}
          className="flex items-center justify-between w-full px-4 py-2 rounded-lg transition-all duration-150 cursor-pointer"
          style={{
            background: '#0d1117',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px',
          }}
        >
          <span>Invite from your contacts</span>
          {contactsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {contactsExpanded && (
          <div
            className="flex gap-3 mt-3 px-1"
            style={{ animation: 'fadeIn 200ms ease-out' }}
          >
            {/* Facebook Messenger */}
            <button
              onClick={handleMessenger}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-all duration-150 cursor-pointer hover:-translate-y-px"
              style={{
                height: '44px',
                background: '#1a2035',
                border: '1px solid rgba(59,130,246,0.4)',
                color: 'rgba(255,255,255,0.8)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 0 8px rgba(59,130,246,0.3)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
            >
              <Send size={13} />
              Messenger
            </button>

            {/* Telegram */}
            <button
              onClick={handleTelegram}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-all duration-150 cursor-pointer hover:-translate-y-px"
              style={{
                height: '44px',
                background: '#1a2035',
                border: '1px solid rgba(6,182,212,0.4)',
                color: 'rgba(255,255,255,0.8)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 0 8px rgba(6,182,212,0.3)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
            >
              <Send size={13} />
              Telegram
            </button>

            {/* Email */}
            <button
              onClick={handleEmail}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-all duration-150 cursor-pointer hover:-translate-y-px"
              style={{
                height: '44px',
                background: '#1a2035',
                border: '1px solid rgba(148,163,184,0.4)',
                color: 'rgba(255,255,255,0.8)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 0 8px rgba(148,163,184,0.3)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
            >
              <Mail size={13} />
              Email
            </button>
          </div>
        )}
      </div>

      {/* Waiting Animation */}
      <div className="flex flex-col items-center gap-3 mt-2">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: '8px',
                height: '8px',
                background: '#3b82f6',
                display: 'inline-block',
                animation: `waitingDot 1.2s ease-in-out infinite`,
                animationDelay: `${i * 400}ms`,
              }}
            />
          ))}
        </div>
        <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Waiting for opponent...
        </p>
      </div>

      <style>{`
        @keyframes waitingDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}