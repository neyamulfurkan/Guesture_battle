import { NextRequest, NextResponse } from 'next/server'

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params

  if (!SOCKET_SERVER_URL) {
    return NextResponse.json(
      { error: 'Socket server URL is not configured.' },
      { status: 503 }
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${SOCKET_SERVER_URL}/rooms/${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (res.status === 404) {
      return NextResponse.json({ exists: false, state: null }, { status: 200 })
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to reach the game server. Please try again.' },
        { status: 502 }
      )
    }

    const data = await res.json() as { exists: boolean; state: string | null }

    return NextResponse.json(
      { exists: data.exists ?? false, state: data.state ?? null },
      { status: 200 }
    )
  } catch (err) {
    clearTimeout(timeout)

    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(
        { error: 'The game server took too long to respond. Please try again.' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: 'Could not connect to the game server. Please check your connection.' },
      { status: 503 }
    )
  }
}