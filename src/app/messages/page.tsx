'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ConversationList } from '@/components/messages/ConversationList'
import { MessageThread } from '@/components/messages/MessageThread'
import { Button } from '@/components/ui/Button'
import type { User } from '@supabase/supabase-js'

interface RemoteUser {
  id: string
  displayName: string
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

export default function MessagesPage() {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedRemoteUser, setSelectedRemoteUser] = useState<RemoteUser | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSendingLink, setIsSendingLink] = useState(false)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.user) {
        setUser(session.user)
        setAuthState('authenticated')
      } else {
        setAuthState('unauthenticated')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session?.user) {
        setUser(session.user)
        setAuthState('authenticated')
      } else {
        setUser(null)
        setAuthState('unauthenticated')
        setSelectedThreadId(null)
        setSelectedRemoteUser(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const handleSelectThread = useCallback((threadId: string, remoteUser: RemoteUser) => {
    setSelectedThreadId(threadId)
    setSelectedRemoteUser(remoteUser)
  }, [])

  const handleChallenge = useCallback((threadId: string) => {
    setSelectedThreadId(threadId)
  }, [])

  const handleBackToList = useCallback(() => {
    setSelectedThreadId(null)
    setSelectedRemoteUser(null)
  }, [])

  const handleSendMagicLink = useCallback(async () => {
    const email = emailInput.trim()
    if (!email) return
    setIsSendingLink(true)
    setAuthError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/messages` },
      })
      if (error) throw error
      setMagicLinkSent(true)
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Could not send magic link. Check your email and try again.'
      )
    } finally {
      setIsSendingLink(false)
    }
  }, [emailInput])

  const handleGoogleSignIn = useCallback(async () => {
    setAuthError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/messages` },
    })
    if (error) {
      setAuthError('Google sign-in failed. Try the magic link option instead.')
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  // Loading state
  if (authState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050810]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#3b82f6] border-t-transparent animate-spin" />
          <span className="text-white/40 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  // Unauthenticated state
  if (authState === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050810] px-4">
        <div
          className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
          style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Logo mark */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-white font-bold text-xl tracking-widest uppercase">GESTURE</span>
            <div className="w-24 h-px bg-[#3b82f6]" />
            <span
              className="font-bold text-xl tracking-widest uppercase"
              style={{
                background: 'linear-gradient(90deg, #3b82f6, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              BATTLE
            </span>
          </div>

          <div className="text-center">
            <h1 className="text-white font-bold text-lg mb-1">Sign in to access messages</h1>
            <p className="text-white/40 text-sm">
              Challenge opponents and keep the rivalry alive.
            </p>
          </div>

          {magicLinkSent ? (
            <div
              className="rounded-xl px-4 py-4 text-center"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <p className="text-[#22c55e] text-sm font-bold mb-1">Check your inbox</p>
              <p className="text-white/50 text-xs">
                We sent a magic link to <strong className="text-white/70">{emailInput}</strong>.
                Click it to sign in.
              </p>
            </div>
          ) : (
            <>
              {/* Google OAuth */}
              <Button
                variant="secondary"
                accentColor="gray"
                size="md"
                onClick={handleGoogleSignIn}
                className="w-full justify-center"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-xs">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Magic link */}
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMagicLink() }}
                  placeholder="your@email.com"
                  className="w-full h-12 px-4 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all"
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
                  onClick={handleSendMagicLink}
                  loading={isSendingLink}
                  disabled={!emailInput.trim()}
                  className="w-full justify-center"
                >
                  Send Magic Link
                </Button>
              </div>

              {authError && (
                <p className="text-[#ef4444] text-xs text-center">{authError}</p>
              )}
            </>
          )}

          <button
            onClick={() => router.push('/')}
            className="text-white/30 text-xs text-center hover:text-white/60 transition-colors mt-2"
          >
            ← Back to home
          </button>
        </div>
      </div>
    )
  }

  // Authenticated — derive display name from user metadata or email
  const localUserId = user!.id
  const localDisplayName: string =
    (user!.user_metadata?.full_name as string | undefined) ||
    (user!.user_metadata?.name as string | undefined) ||
    user!.email?.split('@')[0] ||
    'Player'

  // Mobile: show only one panel at a time
  const showThread = selectedThreadId !== null && selectedRemoteUser !== null

  return (
    <div className="flex flex-col min-h-screen bg-[#050810]">
      {/* Top nav */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0"
        style={{ background: '#0d1117' }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile back button */}
          {showThread && (
            <button
              onClick={handleBackToList}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-white/60 hover:text-white transition-colors"
              aria-label="Back to conversations"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span
              className="font-bold text-sm tracking-widest uppercase"
              style={{
                background: 'linear-gradient(90deg, #3b82f6, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              BATTLE
            </span>
            <span className="text-white/40 text-sm font-bold">MESSAGES</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-white/50 text-xs hidden sm:block">{localDisplayName}</span>
          <Button
            variant="ghost"
            accentColor="gray"
            size="sm"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list — always visible on desktop, hidden on mobile when thread open */}
        <aside
          className={[
            'flex-shrink-0 border-r border-white/10 overflow-hidden',
            'w-full md:w-80 lg:w-96',
            showThread ? 'hidden md:flex md:flex-col' : 'flex flex-col',
          ].join(' ')}
          style={{ background: '#050810' }}
        >
          <div className="px-4 py-3 border-b border-white/10" style={{ background: '#0d1117' }}>
            <h2 className="text-white font-bold text-sm">Opponents</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ConversationList
              localUserId={localUserId}
              onSelectThread={handleSelectThread}
              onChallenge={handleChallenge}
            />
          </div>
        </aside>

        {/* Thread panel — always visible on desktop, shown on mobile when thread selected */}
        <main
          className={[
            'flex-1 overflow-hidden',
            showThread ? 'flex flex-col' : 'hidden md:flex md:flex-col',
          ].join(' ')}
        >
          {showThread && selectedRemoteUser ? (
            <MessageThread
              threadId={selectedThreadId!}
              localUserId={localUserId}
              remoteUser={selectedRemoteUser}
            />
          ) : (
            // Empty state shown on desktop when no thread selected
            <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white/40 text-sm font-bold mb-1">Select a conversation</p>
                <p className="text-white/20 text-xs max-w-xs">
                  Pick an opponent from the list to message them or send a battle challenge.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}