'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { computeThreadId } from '@/lib/utils'

interface OpponentRecord {
  id: string
  displayName: string
  lastPlayedAt: string
  wins: number
  losses: number
  threadId: string
}

interface ConversationListProps {
  localUserId: string
  onSelectThread: (threadId: string, remoteUser: { id: string; displayName: string }) => void
  onChallenge: (threadId: string) => void
}

export function ConversationList({ localUserId, onSelectThread, onChallenge }: ConversationListProps) {
  const [opponents, setOpponents] = useState<OpponentRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [challengingId, setChallengingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!localUserId) return

    async function fetchBattleHistory() {
      setIsLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabase
          .from('battles')
          .select('winner_id, loser_id, winner_display_name, loser_display_name, created_at')
          .or(`winner_id.eq.${localUserId},loser_id.eq.${localUserId}`)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError

        const opponentMap = new Map<string, OpponentRecord>()

        for (const battle of data ?? []) {
          const isWinner = battle.winner_id === localUserId
          const opponentId = isWinner ? battle.loser_id : battle.winner_id
          const opponentName = isWinner ? battle.loser_display_name : battle.winner_display_name

          if (!opponentId || !opponentName) continue

          const existing = opponentMap.get(opponentId)
          const threadId = computeThreadId(localUserId, opponentId)

          if (existing) {
            if (isWinner) existing.wins++
            else existing.losses++
          } else {
            opponentMap.set(opponentId, {
              id: opponentId,
              displayName: opponentName,
              lastPlayedAt: battle.created_at,
              wins: isWinner ? 1 : 0,
              losses: isWinner ? 0 : 1,
              threadId,
            })
          }
        }

        setOpponents(Array.from(opponentMap.values()))
      } catch {
        setError('Could not load battle history. Check your connection and try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchBattleHistory()
  }, [localUserId])

  const handleChallenge = useCallback(async (opponent: OpponentRecord) => {
    setChallengingId(opponent.id)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: opponent.displayName }),
      })

      if (!res.ok) throw new Error('Failed to create room')

      const { roomCode } = await res.json()

      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: opponent.id,
          content: `I challenge you! Join my room: ${roomCode}`,
          isRoomCode: true,
          roomCode,
        }),
      })

      onChallenge(opponent.threadId)
    } catch {
      // Silent failure — challenge button returns to idle
    } finally {
      setChallengingId(null)
    }
  }, [onChallenge])

  function formatDate(iso: string): string {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-[#0d1117] animate-pulse"
            style={{ opacity: 1 - i * 0.2 }}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (opponents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-4xl">⚔️</div>
        <p className="text-sm text-white/50">No battles yet. Create a room and invite someone!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-4 overflow-y-auto">
      {opponents.map(opponent => (
        <div
          key={opponent.id}
          className="flex items-center gap-3 rounded-xl bg-[#0d1117] border border-white/10 px-4 py-3 hover:border-white/20 transition-colors"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1a2035] border border-white/10 flex items-center justify-center text-white font-bold text-sm select-none">
            {opponent.displayName.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-700 text-white truncate">{opponent.displayName}</span>
              <span className="text-xs text-white/30 flex-shrink-0">{formatDate(opponent.lastPlayedAt)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-700 text-[#22c55e]">{opponent.wins}W</span>
              <span className="text-xs text-white/20">/</span>
              <span className="text-xs font-700 text-[#ef4444]">{opponent.losses}L</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              accentColor="blue"
              size="sm"
              onClick={() => onSelectThread(opponent.threadId, { id: opponent.id, displayName: opponent.displayName })}
            >
              Message
            </Button>
            <Button
              variant="primary"
              accentColor="orange"
              size="sm"
              loading={challengingId === opponent.id}
              onClick={() => handleChallenge(opponent)}
            >
              Challenge
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}