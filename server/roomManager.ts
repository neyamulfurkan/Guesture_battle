// server/roomManager.ts
import type { Server, Socket } from 'socket.io'
import {
  RECONNECT_WINDOW_MS,
  ROOM_GC_ENDED_MS,
  ROOM_GC_WAITING_MS,
  ROOM_GC_INTERVAL_MS,
  SOCKET_EVENTS,
  SERVER_MAX_HP,
} from '../src/lib/gameConstants.server'
import type { RoomData, RoomState, PlayerState, PlayerSide, PowerId, StatusEffect } from '../src/types/game'

// ─── EXTENDED SERVER ROOM ────────────────────────────────────────────────────

export interface ServerRoom extends RoomData {
  socketIds: Partial<Record<PlayerSide, string>>
  playerIdToSide: Record<string, PlayerSide>
  lastAttackTimestamp: Record<string, number>
  disconnectTimers: Record<string, NodeJS.Timeout>
  createdAt: number
  endedAt?: number
  peersReady: Set<string>
}

export type ReconnectOrForfeit =
  | { type: 'reconnect_timer_started' }
  | { type: 'forfeit'; winnerId: string }
  | { type: 'not_in_battle' }
  | { type: 'not_found' }
  | { type: 'disconnect_during_battle'; reconnectWindowMs: number }

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function createInitialPlayerState(id: string, displayName: string): PlayerState {
  return {
    id,
    displayName,
    hp: SERVER_MAX_HP,
    maxHp: 100,
    activePower: null,
    statusEffects: [],
    statusTimers: {},
    cooldowns: {},
    unlockedPowers: ['fire_punch', 'shield', 'zap_shot', 'heal'] as PowerId[],
    winStreak: 0,
    hasUsedFullRestore: false,
  }
}

// ─── ROOM MANAGER ────────────────────────────────────────────────────────────

export class RoomManager {
  private rooms: Map<string, ServerRoom> = new Map()
  private gcInterval: NodeJS.Timeout | null = null

  // ── createRoom ─────────────────────────────────────────────────────────────

  createRoom(code: string): ServerRoom {
    const room: ServerRoom = {
      code,
      state: 'waiting',
      localPlayer: createInitialPlayerState('', ''),
      remotePlayer: createInitialPlayerState('', ''),
      sequenceNumber: 0,
      socketIds: {},
      playerIdToSide: {},
      lastAttackTimestamp: {},
      disconnectTimers: {},
      createdAt: Date.now(),
      peersReady: new Set<string>(),
    }
    this.rooms.set(code, room)
    return room
  }

  // ── getRoom ────────────────────────────────────────────────────────────────

  getRoom(code: string): ServerRoom | null {
    return this.rooms.get(code) ?? null
  }

  // ── addPlayer ──────────────────────────────────────────────────────────────
  // Returns false if room is full or does not exist.

  addPlayer(
    code: string,
    socketId: string,
    playerId: string,
    displayName: string,
    io?: Server,
  ): boolean {
    const room = this.rooms.get(code)
    if (!room) return false

    const occupiedSides = Object.keys(room.socketIds) as PlayerSide[]

    if (occupiedSides.includes('local') && occupiedSides.includes('remote')) {
      return false // room full
    }

    const side: PlayerSide = occupiedSides.length === 0 ? 'local' : 'remote'
    const playerState = createInitialPlayerState(playerId, displayName)

    room.socketIds[side] = socketId
    room.playerIdToSide[playerId] = side

    if (side === 'local') {
      room.localPlayer = playerState
    } else {
      room.remotePlayer = playerState
    }

    if (side === 'remote') {
      // Both players present — transition to ready
      room.state = 'ready'

      const localSocketId = room.socketIds['local']
      const remoteSocketId = room.socketIds['remote']

      if (localSocketId && io) {
        io.to(localSocketId).emit(SOCKET_EVENTS.ROOM_STATE_CHANGE, {
          state: 'ready',
          localPlayer: room.localPlayer,
          remotePlayer: room.remotePlayer,
          code: room.code,
        })
      }
      if (remoteSocketId && io) {
        io.to(remoteSocketId).emit(SOCKET_EVENTS.ROOM_STATE_CHANGE, {
          state: 'ready',
          localPlayer: room.remotePlayer,
          remotePlayer: room.localPlayer,
          code: room.code,
        })
      }
    }

    return true
  }

  // ── rejoinPlayer ───────────────────────────────────────────────────────────

  rejoinPlayer(code: string, oldPlayerId: string, newSocketId: string, io?: Server): boolean {
    const room = this.rooms.get(code)
    if (!room) return false

    const side = room.playerIdToSide[oldPlayerId]
    if (!side) return false

    // Cancel any pending disconnect/forfeit timer
    const hadDisconnectTimer = oldPlayerId in room.disconnectTimers
    const existingTimer = room.disconnectTimers[oldPlayerId]
    if (existingTimer) {
      clearTimeout(existingTimer)
      delete room.disconnectTimers[oldPlayerId]
    }

    // Replace socket ID
    room.socketIds[side] = newSocketId

    // Only notify opponent of reconnect if there was an actual disconnect (timer was pending)
    if (hadDisconnectTimer) {
      const opponentSide: PlayerSide = side === 'local' ? 'remote' : 'local'
      const opponentSocketId = room.socketIds[opponentSide]
      if (opponentSocketId && io) {
        io.to(opponentSocketId).emit(SOCKET_EVENTS.OPPONENT_RECONNECTED, {
          playerId: oldPlayerId,
          side,
        })
      }
    }

    // Send current room state to the rejoining player
    io?.to(newSocketId).emit(SOCKET_EVENTS.ROOM_STATE_CHANGE, {
      state: room.state,
      localPlayer: side === 'local' ? room.localPlayer : room.remotePlayer,
      remotePlayer: side === 'local' ? room.remotePlayer : room.localPlayer,
      code: room.code,
    })

    return true
  }

  // ── removePlayer ───────────────────────────────────────────────────────────

  removePlayer(code: string, socketId: string, io?: Server): ReconnectOrForfeit {
    const room = this.rooms.get(code)
    if (!room) return { type: 'not_found' }

    // Identify which side disconnected
    let disconnectedSide: PlayerSide | null = null
    let disconnectedPlayerId: string | null = null

    for (const [side, sid] of Object.entries(room.socketIds) as [PlayerSide, string][]) {
      if (sid === socketId) {
        disconnectedSide = side
        break
      }
    }

    if (!disconnectedSide) return { type: 'not_found' }

    for (const [pid, side] of Object.entries(room.playerIdToSide)) {
      if (side === disconnectedSide) {
        disconnectedPlayerId = pid
        break
      }
    }

    if (!disconnectedPlayerId) return { type: 'not_found' }

    if (room.state !== 'battle') {
      // Outside battle — just clean up
      delete room.socketIds[disconnectedSide]
      delete room.playerIdToSide[disconnectedPlayerId]
      return { type: 'not_in_battle' }
    }

    // In battle — start reconnect timer
    const opponentSide: PlayerSide = disconnectedSide === 'local' ? 'remote' : 'local'
    const opponentSocketId = room.socketIds[opponentSide]

    if (opponentSocketId && io) {
      io.to(opponentSocketId).emit(SOCKET_EVENTS.OPPONENT_DISCONNECTED, {
        playerId: disconnectedPlayerId,
        reconnectWindowMs: RECONNECT_WINDOW_MS,
      })
    }

    const timer = setTimeout(() => {
      // Player failed to reconnect — forfeit
      const currentRoom = this.rooms.get(code)
      if (!currentRoom || currentRoom.state === 'ended') return

      const winnerId =
        disconnectedSide === 'local'
          ? currentRoom.remotePlayer.id
          : currentRoom.localPlayer.id

      currentRoom.state = 'ended'
      currentRoom.endedAt = Date.now()

      // Notify both sockets about game end
      const winnerSocketId = currentRoom.socketIds[opponentSide]
      if (winnerSocketId && io) {
        io.to(winnerSocketId).emit('game_end', {
          winnerId,
          reason: 'forfeit',
          localState:
            opponentSide === 'local' ? currentRoom.localPlayer : currentRoom.remotePlayer,
          remoteState:
            opponentSide === 'local' ? currentRoom.remotePlayer : currentRoom.localPlayer,
        })
      }

      // Clean up timer ref
      delete currentRoom.disconnectTimers[disconnectedPlayerId!]
    }, RECONNECT_WINDOW_MS)

    room.disconnectTimers[disconnectedPlayerId] = timer

    return { type: 'disconnect_during_battle', reconnectWindowMs: RECONNECT_WINDOW_MS }
  }

  // ── getICECredentials ──────────────────────────────────────────────────────

  getICECredentials(): object {
    // For MVP we return empty object — TURN credentials optional
    return {}
  }

  // ── startGarbageCollection ────────────────────────────────────────────────

  startGarbageCollection(): void {
    if (this.gcInterval) return

    this.gcInterval = setInterval(() => {
      const now = Date.now()

      for (const [code, room] of this.rooms.entries()) {
        if (room.state === 'ended' && room.endedAt !== undefined) {
          if (now - room.endedAt > ROOM_GC_ENDED_MS) {
            // Cancel any lingering timers
            for (const timer of Object.values(room.disconnectTimers)) {
              clearTimeout(timer)
            }
            this.rooms.delete(code)
          }
        } else if (room.state === 'waiting') {
          if (now - room.createdAt > ROOM_GC_WAITING_MS) {
            this.rooms.delete(code)
          }
        }
      }
    }, ROOM_GC_INTERVAL_MS)
  }

  // ── getRoomBySocketId ──────────────────────────────────────────────────────

  getRoomCount(): number {
    return this.rooms.size
  }

  getActiveBattleRooms(): ServerRoom[] {
    return Array.from(this.rooms.values()).filter((r) => r.state === 'battle')
  }

  getRoomBySocketId(socketId: string): ServerRoom | null {
    for (const room of this.rooms.values()) {
      for (const sid of Object.values(room.socketIds)) {
        if (sid === socketId) return room
      }
    }
    return null
  }

  // ── isPlayerInRoom ─────────────────────────────────────────────────────────

  isPlayerInRoom(code: string, playerId: string): boolean {
    const room = this.rooms.get(code)
    if (!room) return false
    return playerId in room.playerIdToSide
  }

  // ── listRooms ──────────────────────────────────────────────────────────────

  listRooms(): ServerRoom[] {
    return Array.from(this.rooms.values())
  }
}


// ─── SINGLETON EXPORT ────────────────────────────────────────────────────────

export const roomManager = new RoomManager()