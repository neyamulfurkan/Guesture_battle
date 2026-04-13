import { NextRequest, NextResponse } from 'next/server'
import { generateRoomCode } from '@/lib/utils'

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL

function generatePlayerId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { displayName?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { displayName } = body

  if (typeof displayName !== 'string' || displayName.trim().length < 1 || displayName.trim().length > 30) {
    return NextResponse.json(
      { error: 'Display name must be between 1 and 30 characters.' },
      { status: 400 }
    )
  }

  if (!SOCKET_SERVER_URL) {
    return NextResponse.json(
      { error: 'Game server URL is not configured. Contact support.' },
      { status: 503 }
    )
  }

  const roomCode = generateRoomCode()
  const playerId = generatePlayerId()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${SOCKET_SERVER_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: roomCode, playerId, displayName: displayName.trim() }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: `Game server rejected room creation: ${errorText}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ roomCode, playerId }, { status: 201 })
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          error:
            'The game server did not respond in time. It may be starting up — please try again in a few seconds.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error:
          'Could not reach the game server. Check your connection and try again.',
      },
      { status: 503 }
    )
  }
}