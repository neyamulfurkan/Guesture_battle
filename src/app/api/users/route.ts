import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

const USERNAME_REGEX = /^[a-zA-Z0-9_]{2,20}$/

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'Missing required parameter: id' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, level, total_wins, total_losses, unlocked_powers')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    displayName: data.display_name,
    level: data.level,
    totalWins: data.total_wins,
    totalLosses: data.total_losses,
    unlockedPowers: data.unlocked_powers,
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  const {
    data: { user },
    error: authError,
  } = token
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required. Please sign in to create or update your profile.' },
      { status: 401 }
    )
  }

  let body: { username?: unknown; displayName?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { username, displayName } = body

  if (typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      {
        error:
          'Username must be 2–20 characters and contain only letters, numbers, and underscores.',
      },
      { status: 400 }
    )
  }

  if (
    typeof displayName !== 'string' ||
    displayName.trim().length < 1 ||
    displayName.trim().length > 30
  ) {
    return NextResponse.json(
      { error: 'Display name must be between 1 and 30 characters.' },
      { status: 400 }
    )
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'That username is already taken. Please choose a different one.' },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        username: username,
        display_name: displayName.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id, username, display_name, level, total_wins, total_losses, unlocked_powers')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'That username is already taken. Please choose a different one.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to save your profile. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    level: data.level,
    totalWins: data.total_wins,
    totalLosses: data.total_losses,
    unlockedPowers: data.unlocked_powers,
  })
}