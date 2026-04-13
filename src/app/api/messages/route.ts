import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { computeThreadId } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId || userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: sentMessages, error: sentError } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, content, created_at, is_room_code, room_code, thread_id')
    .eq('sender_id', userId)
    .order('created_at', { ascending: false })

  if (sentError) {
    return NextResponse.json({ error: 'Failed to fetch sent messages' }, { status: 500 })
  }

  const { data: receivedMessages, error: receivedError } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, content, created_at, is_room_code, room_code, thread_id')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })

  if (receivedError) {
    return NextResponse.json({ error: 'Failed to fetch received messages' }, { status: 500 })
  }

  const allMessages = [...(sentMessages ?? []), ...(receivedMessages ?? [])]

  const threadMap = new Map<string, {
    opponentId: string
    latestMessage: { content: string; createdAt: string; isRoomCode: boolean }
    unreadCount: number
    threadId: string
  }>()

  for (const msg of allMessages) {
    const opponentId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id
    const threadId = computeThreadId(userId, opponentId)

    const existing = threadMap.get(threadId)
    const msgDate = new Date(msg.created_at)

    if (!existing || msgDate > new Date(existing.latestMessage.createdAt)) {
      threadMap.set(threadId, {
        opponentId,
        latestMessage: {
          content: msg.content,
          createdAt: msg.created_at,
          isRoomCode: msg.is_room_code ?? false,
        },
        unreadCount: existing?.unreadCount ?? 0,
        threadId,
      })
    }

    if (msg.recipient_id === userId && msg.sender_id !== userId) {
      const entry = threadMap.get(threadId)
      if (entry) {
        entry.unreadCount += 1
      }
    }
  }

  const opponentIds = Array.from(threadMap.values()).map((t) => t.opponentId)

  let profilesMap: Record<string, { display_name: string }> = {}

  if (opponentIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', opponentIds)

    if (profiles) {
      for (const p of profiles) {
        profilesMap[p.id] = { display_name: p.display_name }
      }
    }
  }

  const conversations = Array.from(threadMap.values())
    .sort((a, b) => new Date(b.latestMessage.createdAt).getTime() - new Date(a.latestMessage.createdAt).getTime())
    .map((t) => ({
      threadId: t.threadId,
      opponentId: t.opponentId,
      opponentDisplayName: profilesMap[t.opponentId]?.display_name ?? 'Unknown Player',
      latestMessage: t.latestMessage,
      unreadCount: t.unreadCount,
    }))

  return NextResponse.json({ conversations })
}

export async function POST(request: NextRequest) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    recipientId?: string
    content?: string
    isRoomCode?: boolean
    roomCode?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { recipientId, content, isRoomCode = false, roomCode } = body

  if (!recipientId || typeof recipientId !== 'string') {
    return NextResponse.json({ error: 'recipientId is required' }, { status: 400 })
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'content is required and must be non-empty' }, { status: 400 })
  }

  if (content.length > 1000) {
    return NextResponse.json({ error: 'content must be 1000 characters or fewer' }, { status: 400 })
  }

  const threadId = computeThreadId(user.id, recipientId)

  const { count, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId)

  if (countError) {
    return NextResponse.json({ error: 'Failed to check message count' }, { status: 500 })
  }

  if ((count ?? 0) >= 50) {
    const { data: oldest, error: oldestError } = await supabase
      .from('messages')
      .select('id')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (oldestError || !oldest) {
      return NextResponse.json({ error: 'Failed to fetch oldest message for trim' }, { status: 500 })
    }

    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', oldest.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to trim thread' }, { status: 500 })
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      recipient_id: recipientId,
      content: content.trim(),
      is_room_code: isRoomCode,
      room_code: isRoomCode && roomCode ? roomCode : null,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return NextResponse.json({ error: 'Failed to insert message' }, { status: 500 })
  }

  return NextResponse.json({ messageId: inserted.id, threadId }, { status: 201 })
}