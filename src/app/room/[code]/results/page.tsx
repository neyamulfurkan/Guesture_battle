'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { PlayerResult } from '@/components/postbattle/PlayerResult'
import { PowerUnlockCard } from '@/components/postbattle/PowerUnlockCard'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabaseClient'
import type { PlayerState, PowerId } from '@/types/game'

const BackgroundParticles = dynamic(() => import('@/components/particles/BackgroundParticles'), {
  ssr: false,
})

interface BattleResult {
  localPlayer: PlayerState
  remotePlayer: PlayerState
  winnerId: string
  localPlayerId: string
  newlyUnlockedPower: PowerId | null
  roomCode: string
  remotePlayerId: string
}

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = params.code as string

  const [result, setResult] = useState<BattleResult | null>(null)
  const [mounted, setMounted] = useState(false)
  const [rematchLoading, setRematchLoading] = useState(false)
  const profileUpdated = useRef(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('battleResult')
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as BattleResult
        setResult(parsed)
      } catch {
        router.push('/')
      }
    } else {
      router.push('/')
    }

    const raf = requestAnimationFrame(() => {
      setMounted(true)
    })

    return () => cancelAnimationFrame(raf)
  }, [router])

  useEffect(() => {
    if (!result || profileUpdated.current) return
    profileUpdated.current = true

    const updateProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const isWinner = result.winnerId === result.localPlayerId

      if (isWinner) {
        await supabase.rpc('increment_win', { user_id: session.user.id })
      } else {
        await supabase.rpc('increment_loss', { user_id: session.user.id })
      }

      if (result.newlyUnlockedPower) {
        await supabase.rpc('unlock_power', {
          user_id: session.user.id,
          power_id: result.newlyUnlockedPower,
        })
      }
    }

    updateProfile()
  }, [result])

  const handleRematch = async () => {
    if (!result) return
    setRematchLoading(true)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: result.localPlayer.displayName }),
      })
      if (!res.ok) throw new Error('Failed to create room')
      const { roomCode: newCode } = await res.json()
      sessionStorage.removeItem('battleResult')
      router.push(`/room/${newCode}`)
    } catch {
      setRematchLoading(false)
    }
  }

  const handleNewBattle = () => {
    sessionStorage.removeItem('battleResult')
    router.push('/')
  }

  if (!result) return null

  const isLocalWinner = result.winnerId === result.localPlayerId
  const localXP = isLocalWinner ? 100 : 40
  const remoteXP = isLocalWinner ? 40 : 100

  const winnerState = isLocalWinner ? result.localPlayer : result.remotePlayer
  const loserState = isLocalWinner ? result.remotePlayer : result.localPlayer
  const winnerXP = isLocalWinner ? localXP : remoteXP
  const loserXP = isLocalWinner ? remoteXP : localXP

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: '#050810',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 500ms ease',
      }}
    >
      <BackgroundParticles />

      <div
        className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4 py-8 gap-6"
      >
        {/* Header */}
        <div className="text-center">
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Battle Over
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: 2,
            }}
          >
            {isLocalWinner ? '🏆 You Won!' : 'Battle Complete'}
          </h1>
        </div>

        {/* Player results */}
        <div
          className="w-full flex items-center justify-center"
          style={{
            background: '#0d1117',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            overflow: 'hidden',
            minHeight: 320,
          }}
        >
          <PlayerResult
            playerState={winnerState}
            isWinner={true}
            xpEarned={winnerXP}
            stream={isLocalWinner ? null : null}
          />
          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              background: 'rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}
          />
          <PlayerResult
            playerState={loserState}
            isWinner={false}
            xpEarned={loserXP}
            stream={null}
          />
        </div>

        {/* Power unlock card */}
        {result.newlyUnlockedPower && (
          <div className="w-full max-w-md">
            <PowerUnlockCard unlockedPowerId={result.newlyUnlockedPower} />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Button
            variant="primary"
            accentColor="blue"
            size="lg"
            onClick={handleRematch}
            loading={rematchLoading}
            className="flex-1"
          >
            ⚔️ Rematch
          </Button>
          <Button
            variant="secondary"
            accentColor="gray"
            size="lg"
            onClick={handleNewBattle}
            className="flex-1"
          >
            New Battle
          </Button>
        </div>

        <Button
          variant="ghost"
          accentColor="gray"
          size="sm"
          onClick={handleNewBattle}
        >
          Back to Home
        </Button>
      </div>
    </div>
  )
}