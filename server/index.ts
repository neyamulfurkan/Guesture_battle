import express from 'express'
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { roomManager, RoomManager } from './roomManager'
import { GameEngine } from './gameEngine'
import { SOCKET_EVENTS, SERVER_RATE_LIMIT_ATTACK_MS, POWER_DEFINITIONS } from '../src/lib/gameConstants.server'
import type { SocketRoomJoinPayload, SocketAttackPayload, GameEvent } from '../src/types/game'

const app = express()
app.use(express.json())

const httpServer = createServer(app)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '*'
const PORT = process.env.PORT ?? 3001

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

const gameEngine = new GameEngine()

// ─── REST ENDPOINTS ──────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: roomManager.getRoomCount() })
})

// Keep-alive endpoint — prevents Render free tier spin-down
app.get('/ping', (_req, res) => {
  res.json({ pong: true, ts: Date.now() })
})

app.get('/rooms/:code', (req, res) => {
  const { code } = req.params
  const room = roomManager.getRoom(code.toUpperCase())
  if (!room) {
    return res.json({ exists: false, state: null })
  }
  return res.json({ exists: true, state: room.state })
})

app.post('/rooms', (req, res) => {
  const { code } = req.body as { code: string }
  if (!code || typeof code !== 'string' || code.length < 4) {
    return res.status(400).json({ error: 'Invalid room code' })
  }
  const existing = roomManager.getRoom(code.toUpperCase())
  if (existing) {
    return res.status(409).json({ error: 'Room code already in use' })
  }
  const room = roomManager.createRoom(code.toUpperCase())
  return res.json({ code: room.code, state: room.state })
})

// ─── SOCKET.IO CONNECTION ────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`)

  // ── JOIN ROOM ──────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.JOIN_ROOM, (payload: SocketRoomJoinPayload, callback?: (res: { error?: string }) => void) => {
    try {
      if (!payload || !payload.roomCode || !payload.playerId) {
        callback?.({ error: 'Invalid join payload.' })
        return
      }
      const { roomCode, playerId, displayName } = payload
      const code = roomCode.toUpperCase()
      const room = roomManager.getRoom(code)

      if (!room) {
        callback?.({ error: `Room "${code}" does not exist. Ask your opponent to create a new room.` })
        return
      }

      // If this player is already known in the room (any state), treat as a socket reconnect
      const isKnownPlayer = roomManager.isPlayerInRoom(code, playerId)
      if (isKnownPlayer) {
        const rejoined = roomManager.rejoinPlayer(code, playerId, socket.id, io)
        if (rejoined) {
          socket.join(code)
          callback?.({})
        } else {
          callback?.({ error: 'Could not reconnect to room. Please create a new room.' })
        }
        return
      }

      if (room.state !== 'waiting') {
        callback?.({ error: 'This battle has already started. Create a new room to play.' })
        return
      }

      socket.join(code)

      const added = roomManager.addPlayer(code, socket.id, playerId, displayName, io)
      if (!added) {
        callback?.({ error: 'Room is full. Both player slots are already taken.' })
        return
      }

      // Reset per-player sequence number so a fresh battle page always starts clean
      gameEngine.resetPlayerSequence(playerId)
      callback?.({})

      const updatedRoom = roomManager.getRoom(code)!

      console.log(`Player ${playerId} joined room ${code}, state: ${updatedRoom.state}`)
    } catch (err) {
      console.error('JOIN_ROOM error:', err)
      callback?.({ error: 'Server error joining room.' })
    }
  })

  // ── REJOIN ROOM ────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.REJOIN_ROOM, (payload: SocketRoomJoinPayload) => {
    try {
      if (!payload || !payload.roomCode || !payload.playerId) return
      const { roomCode, playerId, displayName } = payload
      const code = roomCode.toUpperCase()

      const rejoined = roomManager.rejoinPlayer(code, playerId, socket.id)
      if (!rejoined) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Unable to rejoin — the battle may have ended. Create a new room to play again.',
        })
        return
      }

      socket.join(code)
      const room = roomManager.getRoom(code)!

      socket.emit(SOCKET_EVENTS.ROOM_STATE_CHANGE, {
        state: room.state,
        roomCode: code,
        localPlayerId: playerId,
        localPlayer: room.localPlayer.id === playerId ? room.localPlayer : room.remotePlayer,
        remotePlayer: room.localPlayer.id === playerId ? room.remotePlayer : room.localPlayer,
      })

      socket.to(code).emit(SOCKET_EVENTS.OPPONENT_RECONNECTED, {
        playerId,
        displayName,
      })
    } catch (err) {
      console.error('REJOIN_ROOM error:', err)
    }
  })

  // ── LEAVE ROOM ─────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.LEAVE_ROOM, (payload: { roomCode: string }) => {
    try {
      if (!payload || !payload.roomCode) return
      const code = payload.roomCode.toUpperCase()
      handlePlayerLeave(socket, code)
    } catch (err) {
      console.error('LEAVE_ROOM error:', err)
    }
  })

  // ── GAME EVENT ─────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.GAME_EVENT, (payload: SocketAttackPayload) => {
    try {
      if (!payload || !payload.roomCode || !payload.playerId || !payload.power) {
        console.log(`GAME_EVENT dropped: invalid payload`, payload)
        return
      }
      const code = payload.roomCode.toUpperCase()
      const room = roomManager.getRoom(code)

      if (!room) {
        console.log(`GAME_EVENT dropped: room '${code}' not found. Available rooms: [${roomManager.listRooms().map(r => r.code).join(', ')}]`)
        socket.emit(SOCKET_EVENTS.ERROR, { message: `Room not found. Your session may have expired — please go back and create a new room.` })
        return
      }

      const { playerId, power, sequenceNumber } = payload
      const serverNow = Date.now()

      // Guard: only process game events when room is in battle state
      if (room.state !== 'battle') {
        console.log(`GAME_EVENT dropped: room ${code} state is '${room.state}', not 'battle'. playerId=${playerId} power=${power}`)
        socket.emit(SOCKET_EVENTS.ERROR, { message: `Battle not started yet. Room is in '${room.state}' state.` })
        return
      }

      // Guard: player must be registered in this room
      if (!roomManager.isPlayerInRoom(code, playerId)) {
        console.log(`GAME_EVENT dropped: playerId=${playerId} not found in room ${code}. Known players: [${Object.keys(room.playerIdToSide).join(', ')}]`)
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Player not found in room. Please go back and rejoin.' })
        return
      }

      const lastAttack = room.lastAttackTimestamp[playerId] ?? 0
      if (serverNow - lastAttack < SERVER_RATE_LIMIT_ATTACK_MS) {
        socket.emit(SOCKET_EVENTS.RATE_LIMITED, { power })
        return
      }

      // Record timestamp here using server time so both checks use the same clock
      room.lastAttackTimestamp[playerId] = serverNow

      const powerDef = POWER_DEFINITIONS[power]
      const isHeal = powerDef?.healAmount !== undefined && (powerDef.damage === undefined || powerDef.damage === 0)
      const isDefend = power === 'shield' || power === 'reflect_dome'
      const eventType: GameEvent['type'] = isHeal ? 'heal' : isDefend ? 'defend' : 'attack'
      const gameEvent: GameEvent = {
        type: eventType,
        power,
        attackerId: playerId,
        targetId:
          room.localPlayer.id === playerId
            ? room.remotePlayer.id
            : room.localPlayer.id,
        damage: powerDef?.damage ?? 0,
        healAmount: powerDef?.healAmount ?? 0,
        sequenceNumber,
        timestamp: serverNow,
      }

      gameEngine.processGameEvent(room, gameEvent, io)
    } catch (err) {
      console.error('GAME_EVENT error:', err)
    }
  })

  // ── WEBRTC SIGNALING ───────────────────────────────────────────────────────
  socket.on(
    SOCKET_EVENTS.SIGNAL_OFFER,
    (payload: { roomCode: string; offer: RTCSessionDescriptionInit; targetId: string }) => {
      try {
        if (!payload || !payload.roomCode) return
        const code = payload.roomCode.toUpperCase()
        const room = roomManager.getRoom(code)
        if (!room) return
        const targetSocketId = getTargetSocketId(room, socket.id)
        if (targetSocketId) {
          io.to(targetSocketId).emit(SOCKET_EVENTS.SIGNAL_OFFER, {
            offer: payload.offer,
            fromId: socket.id,
          })
        }
      } catch (err) {
        console.error('SIGNAL_OFFER error:', err)
      }
    }
  )

  socket.on(
    SOCKET_EVENTS.SIGNAL_ANSWER,
    (payload: { roomCode: string; answer: RTCSessionDescriptionInit; targetId: string }) => {
      try {
        if (!payload || !payload.roomCode) return
        const code = payload.roomCode.toUpperCase()
        const room = roomManager.getRoom(code)
        if (!room) return
        const targetSocketId = getTargetSocketId(room, socket.id)
        if (targetSocketId) {
          io.to(targetSocketId).emit(SOCKET_EVENTS.SIGNAL_ANSWER, {
            answer: payload.answer,
            fromId: socket.id,
          })
        }
      } catch (err) {
        console.error('SIGNAL_ANSWER error:', err)
      }
    }
  )

  socket.on(
    SOCKET_EVENTS.SIGNAL_ICE,
    (payload: { roomCode: string; candidate: RTCIceCandidateInit }) => {
      try {
        if (!payload || !payload.roomCode) return
        const code = payload.roomCode.toUpperCase()
        const room = roomManager.getRoom(code)
        if (!room) return
        const targetSocketId = getTargetSocketId(room, socket.id)
        if (targetSocketId) {
          io.to(targetSocketId).emit(SOCKET_EVENTS.SIGNAL_ICE, {
            candidate: payload.candidate,
            fromId: socket.id,
          })
        }
      } catch (err) {
        console.error('SIGNAL_ICE error:', err)
      }
    }
  )

  // ── PEER READY ─────────────────────────────────────────────────────────────
  socket.on('peer_ready', (payload: { roomCode: string }) => {
    try {
      if (!payload || !payload.roomCode) return
      const code = payload.roomCode.toUpperCase()
      const room = roomManager.getRoom(code)
      if (!room) return

      // Track how many peers have signaled ready
room.peersReady.add(socket.id)
const peersReady = room.peersReady

      // Relay to the other peer so initiator can send offer
      const targetSocketId = getTargetSocketId(room, socket.id)
      if (targetSocketId) {
        io.to(targetSocketId).emit('peer_ready', { fromId: socket.id })
      }

      // When both peers are ready, transition to battle and start countdown
      if (peersReady.size >= 2 && (room.state === 'ready' || room.state === 'battle')) {
        room.state = 'battle'
        io.to(code).emit(SOCKET_EVENTS.ROOM_STATE_CHANGE, {
          state: 'battle',
          roomCode: code,
        })
      }
    } catch (err) {
      console.error('PEER_READY error:', err)
    }
  })

  // ── DISCONNECT ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    try {
      console.log(`Socket disconnected: ${socket.id}`)
      const roomCode = findRoomBySocketId(socket.id)
      if (roomCode) {
        handlePlayerLeave(socket, roomCode)
      }
    } catch (err) {
      console.error('DISCONNECT error:', err)
    }
  })
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getTargetSocketId(
  room: ReturnType<RoomManager['getRoom']>,
  fromSocketId: string
): string | null {
  if (!room) return null
  const sids = room.socketIds as Record<string, string>
  return Object.values(sids).find((sid) => sid !== fromSocketId) ?? null
}

function findRoomBySocketId(socketId: string): string | null {
  const room = roomManager.getRoomBySocketId(socketId)
  return room ? room.code : null
}

function handlePlayerLeave(socket: Socket, code: string): void {
  try {
    const result = roomManager.removePlayer(code, socket.id)
    socket.leave(code)

    if (result.type === 'not_found') return

    if (result.type === 'disconnect_during_battle') {
      socket.to(code).emit(SOCKET_EVENTS.OPPONENT_DISCONNECTED, {
        reconnectWindowMs: result.reconnectWindowMs,
      })
    } else if (result.type === 'forfeit') {
      const room = roomManager.getRoom(code)
      if (room) {
        gameEngine.endGame(room, result.winnerId, io)
      }
    }
  } catch (err) {
    console.error('handlePlayerLeave error:', err)
  }
}

// ─── STATUS EXPIRY TICKER ────────────────────────────────────────────────────

setInterval(() => {
  try {
    const activeBattleRooms = roomManager.getActiveBattleRooms()
    for (const room of activeBattleRooms) {
      gameEngine.processStatusExpiry(room, io)
    }
  } catch (err) {
    console.error('Status expiry ticker error:', err)
  }
}, 100)

// ─── GARBAGE COLLECTION ───────────────────────────────────────────────────────

roomManager.startGarbageCollection()

// ─── START ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`GestureBattle Socket.io server running on port ${PORT}`)
})