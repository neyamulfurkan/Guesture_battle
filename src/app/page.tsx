'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Hand, Mic, Smile } from 'lucide-react'
import dynamic from 'next/dynamic'
import LogoMark from '@/components/home/LogoMark'
import { FeatureBadge } from '@/components/home/FeatureBadge'
import { Button } from '@/components/ui/Button'
import PermissionCard from '@/components/camera/PermissionCard'
import type { HandsResults } from '@/types/mediapipe.d'

const BackgroundParticles = dynamic(() => import('@/components/particles/BackgroundParticles'), {
  ssr: false,
})

type CurrentView = 'landing' | 'camera_permission'

export default function HomePage() {
  const router = useRouter()
  const [currentView, setCurrentView] = useState<CurrentView>('landing')
  const nextStepRef = useRef<'create' | 'join'>('create')

  const handleCreateRoom = useCallback(() => {
    nextStepRef.current = 'create'
    setCurrentView('camera_permission')
  }, [])

  const handleJoinRoom = useCallback(() => {
    nextStepRef.current = 'join'
    setCurrentView('camera_permission')
  }, [])

  const handlePermissionReady = useCallback(
    (_stream: MediaStream, _landmarkData: HandsResults | null) => {
      // Stream is verified working; navigate and let the destination page re-request
      if (nextStepRef.current === 'create') {
        router.push('/room/new')
      } else {
        router.push('/room/join')
      }
    },
    [router]
  )

  const handleBackToLanding = useCallback(() => {
    setCurrentView('landing')
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        backgroundColor: '#050810',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <BackgroundParticles />

      {/* ── LANDING VIEW ── */}
      {currentView === 'landing' && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            width: '100%',
            maxWidth: 560,
            padding: '0 24px',
          }}
        >
          {/* Logo at ~45% vertical */}
          <div style={{ marginBottom: 20 }}>
            <LogoMark />
          </div>

          {/* Tagline */}
          <p
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.45)',
              margin: '0 0 40px',
              textAlign: 'center',
              lineHeight: 1.6,
              letterSpacing: '0.5px',
            }}
          >
            Fight your friends. No controllers.
            <br />
            Just your hands, your voice, and your face.
          </p>

          {/* Primary action buttons */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              width: '100%',
              maxWidth: 320,
              marginBottom: 40,
            }}
          >
            <Button
              variant="primary"
              accentColor="blue"
              size="lg"
              onClick={handleCreateRoom}
              style={{ width: '100%' }}
            >
              Create a Battle Room
            </Button>
            <Button
              variant="secondary"
              accentColor="purple"
              size="lg"
              onClick={handleJoinRoom}
              style={{ width: '100%' }}
            >
              Join with a Code
            </Button>
          </div>

          {/* Feature badges */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
              marginBottom: 48,
            }}
          >
            <FeatureBadge icon={Hand} label="Gesture Control" accentColor="#3b82f6" />
            <FeatureBadge icon={Mic} label="Voice Commands" accentColor="#a855f7" />
            <FeatureBadge icon={Smile} label="Face Expressions" accentColor="#06b6d4" />
          </div>

          {/* Footer */}
          <p
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.2)',
              textAlign: 'center',
              margin: 0,
              letterSpacing: '0.5px',
            }}
          >
            No account required · No app to install · 100% browser-based
          </p>
        </div>
      )}

      {/* ── CAMERA PERMISSION VIEW ── */}
      {currentView === 'camera_permission' && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            maxWidth: 520,
            padding: '24px 16px',
            gap: 16,
          }}
        >
          {/* Back link */}
          <div style={{ width: '100%', maxWidth: 480 }}>
            <button
              type="button"
              onClick={handleBackToLanding}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)',
                fontSize: 13,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ← Back
            </button>
          </div>

          <PermissionCard onReady={handlePermissionReady} />
        </div>
      )}
    </div>
  )
}