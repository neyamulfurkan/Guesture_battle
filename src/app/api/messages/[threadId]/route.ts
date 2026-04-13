import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

interface Message {
  id: string
  senderId: string
  content: string
  isRoomCode: boolean
  roomCode: string | null
  createdAt: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
): Promise<NextResponse> {
  const { threadId } = params

  const { data: { session }, error: authError } = await supabase.auth.getSession()
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const parts = threadId.split(':')

  if (parts.length !== 2) {
    return NextResponse.json({ error: 'Invalid thread ID format' }, { status: 400 })
  }

  const [participantA, participantB] = parts
  if (userId !== participantA && userId !== participantB) {
    return NextResponse.json({ error: 'Forbidden: you are not a participant in this thread' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, content, is_room_code, room_code, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  const messages: Message[] = (data ?? []).map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    content: row.content,
    isRoomCode: row.is_room_code ?? false,
    roomCode: row.room_code ?? null,
    createdAt: row.created_at,
  }))

  return NextResponse.json({ messages })
}