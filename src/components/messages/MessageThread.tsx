'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'

interface Message {
  id: string
  sender_id: string
  content: string
  is_room_code: boolean
  room_code: string | null
  created_at: string
  thread_id: string
}

interface MessageThreadProps {
  threadId: string
  localUserId: string
  remoteUser: { id: string; displayName: string }
}

const MAX_MESSAGES = 50

export function MessageThread({ threadId, localUserId, remoteUser }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchMessages() {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(MAX_MESSAGES)

      if (!cancelled && !error && data) {
        setMessages(data as Message[])
      }
      if (!cancelled) setIsLoading(false)
    }

    fetchMessages()

    const channel = supabase
      .channel('thread:' + threadId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            const updated = [...prev, newMsg]
            return updated.slice(-MAX_MESSAGES)
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [threadId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  async function handleSend() {
    const content = inputValue.trim()
    if (!content || isSending) return

    setIsSending(true)
    setInputValue('')

    const optimisticMsg: Message = {
      id: 'optimistic-' + Date.now(),
      sender_id: localUserId,
      content,
      is_room_code: false,
      room_code: null,
      created_at: new Date().toISOString(),
      thread_id: threadId,
    }

    setMessages((prev) => {
      const updated = [...prev, optimisticMsg]
      return updated.slice(-MAX_MESSAGES)
    })

    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId)

      if ((count ?? 0) >= MAX_MESSAGES) {
        const { data: oldest } = await supabase
          .from('messages')
          .select('id')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
          .limit(1)
          .single()

        if (oldest) {
          await supabase.from('messages').delete().eq('id', oldest.id)
        }
      }

      const { data: inserted, error } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: localUserId,
          content,
          is_room_code: false,
          room_code: null,
        })
        .select()
        .single()

      if (!error && inserted) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? (inserted as Message) : m))
        )
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      setInputValue(content)
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleJoinRoom(roomCode: string) {
    window.location.href = `/room/${roomCode}`
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <div className="w-5 h-5 rounded-full border-2 border-[#3b82f6] border-t-transparent animate-spin" />
        <span className="text-white/40 text-xs">Loading messages...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#050810]">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-white/10 flex items-center gap-3"
        style={{ background: '#0d1117' }}
      >
        <div className="w-8 h-8 rounded-full bg-[#1a2035] border border-[#3b82f6]/40 flex items-center justify-center">
          <span className="text-xs font-bold text-[#3b82f6]">
            {remoteUser.displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="text-white font-bold text-sm">{remoteUser.displayName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/30 text-sm text-center">
              No messages yet.
              <br />
              Say hello or challenge them to a battle!
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isLocal = msg.sender_id === localUserId

          if (msg.is_room_code && msg.room_code) {
            return (
              <div
                key={msg.id}
                className={`flex ${isLocal ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[72%] rounded-2xl px-4 py-3 flex flex-col gap-2"
                  style={{
                    background: isLocal ? '#1e3a5f' : '#1a2035',
                    border: '1px solid #3b82f6',
                  }}
                >
                  <p className="text-[#3b82f6] text-xs font-bold uppercase tracking-widest">
                    Battle Challenge
                  </p>
                  <p className="text-white/70 text-sm">{msg.content}</p>
                  <div
                    className="px-3 py-1.5 rounded-lg text-center font-bold text-sm tracking-widest"
                    style={{
                      background: '#0a0a1a',
                      border: '1px solid #3b82f6',
                      color: '#3b82f6',
                      letterSpacing: '0.2em',
                    }}
                  >
                    {msg.room_code}
                  </div>
                  <Button
                    variant="primary"
                    accentColor="blue"
                    size="sm"
                    onClick={() => handleJoinRoom(msg.room_code!)}
                  >
                    Join Room →
                  </Button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isLocal ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[72%] rounded-2xl px-4 py-2.5"
                style={{
                  background: isLocal ? '#1d4ed8' : '#1a2035',
                  borderRadius: isLocal
                    ? '18px 18px 4px 18px'
                    : '18px 18px 18px 4px',
                }}
              >
                <p className="text-white text-sm leading-relaxed break-words">
                  {msg.content}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: isLocal ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)' }}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 py-3 border-t border-white/10 flex items-center gap-2"
        style={{ background: '#0d1117' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={500}
          disabled={isSending}
          className="flex-1 h-12 px-4 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all"
          style={{
            background: '#1a2035',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        <Button
          variant="primary"
          accentColor="blue"
          size="md"
          onClick={handleSend}
          loading={isSending}
          disabled={!inputValue.trim()}
        >
          Send
        </Button>
      </div>
    </div>
  )
}