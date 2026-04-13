// server/gameEngine.ts
// Authoritative server-side game event processor for GestureBattle.

import type { Server } from 'socket.io'

import {
  SERVER_RATE_LIMIT_ATTACK_MS,
  SOCKET_EVENTS,
} from '../src/lib/gameConstants.server'

import type { GameEvent, PlayerState } from '../src/types/game'

import {
  applyGameEvent,
  validateAttack,
  isRoomStateValid,
  expireStatuses,
} from '../src/services/gameStateService'

import type { ServerRoom } from './roomManager'

// ─── GAME ENGINE ─────────────────────────────────────────────────────────────

export class GameEngine {
  // ── processGameEvent ───────────────────────────────────────────────────────

  processGameEvent(room: ServerRoom, event: GameEvent, io: Server): void {
    // Guard: room must be in battle state
    if (room.state !== 'battle') {
      return
    }

    // Guard: isRoomStateValid cross-check
    if (!isRoomStateValid(room.state, event.type)) {
      return
    }

    // Guard: sequence number must be strictly greater than last processed
    if (event.sequenceNumber <= room.sequenceNumber) {
      return
    }

    // Rate limiting: reject attack events arriving too quickly from the same player
    if (event.type === 'attack') {
      const lastTs = room.lastAttackTimestamp[event.attackerId]
      if (lastTs !== undefined && event.timestamp - lastTs < SERVER_RATE_LIMIT_ATTACK_MS) {
        // Emit rate_limited only to the attacker's socket
        const attackerSocket = this._socketForPlayer(room, event.attackerId)
        if (attackerSocket) {
          io.to(attackerSocket).emit(SOCKET_EVENTS.RATE_LIMITED, {
            reason: 'Attack rate limit exceeded.',
          })
        }
        return
      }

      // Validate the attack against the attacker's current state
      const attackerState = this._stateForPlayer(room, event.attackerId)
      if (!attackerState) return

      const validation = validateAttack(attackerState, event.power!, event.timestamp)
      if (!validation.valid) {
        return
      }

      // Record attack timestamp for future rate limiting
      room.lastAttackTimestamp[event.attackerId] = event.timestamp
    }

    // Apply the event immutably via gameStateService
    const updatedRoom = applyGameEvent(room as unknown as import('../src/types/game').RoomData, event)

    // Mutate in-memory room with updated state
    room.state = updatedRoom.state
    room.localPlayer = updatedRoom.localPlayer
    room.remotePlayer = updatedRoom.remotePlayer
    room.sequenceNumber = updatedRoom.sequenceNumber

    // Broadcast updated state to both players
    this._broadcastState(room, event, io)

    // End game if anyone's HP hit zero
    if (room.localPlayer.hp <= 0 || room.remotePlayer.hp <= 0) {
      const winnerId =
        room.localPlayer.hp <= 0 ? room.remotePlayer.id : room.localPlayer.id
      this.endGame(room, winnerId, io)
    }
  }

  // ── endGame ────────────────────────────────────────────────────────────────

  endGame(room: ServerRoom, winnerId: string, io: Server): void {
    room.state = 'ended'
    room.endedAt = Date.now()

    const loserId =
      room.localPlayer.id === winnerId ? room.remotePlayer.id : room.localPlayer.id

    const resultPayload = {
      winnerId,
      loserId,
      localPlayer: room.localPlayer,
      remotePlayer: room.remotePlayer,
      sequenceNumber: room.sequenceNumber,
    }

    // Broadcast game end to both players in the room
    for (const socketId of Object.values(room.socketIds)) {
      if (socketId) {
        io.to(socketId).emit('game_end', resultPayload)
      }
    }
  }

  // ── processStatusExpiry ────────────────────────────────────────────────────

  processStatusExpiry(room: ServerRoom, io: Server): void {
    if (room.state !== 'battle') return

    const now = Date.now()

    const updatedLocal = expireStatuses(room.localPlayer, now)
    const updatedRemote = expireStatuses(room.remotePlayer, now)

    const localChanged =
      updatedLocal.statusEffects.length !== room.localPlayer.statusEffects.length ||
      updatedLocal.statusEffects.some((e: string, i: number) => e !== room.localPlayer.statusEffects[i])

    const remoteChanged =
      updatedRemote.statusEffects.length !== room.remotePlayer.statusEffects.length ||
      updatedRemote.statusEffects.some((e: string, i: number) => e !== room.remotePlayer.statusEffects[i])

    if (!localChanged && !remoteChanged) return

    room.localPlayer = updatedLocal
    room.remotePlayer = updatedRemote

    // Synthesize a status_expire event for broadcast context
    const expiryEvent: GameEvent = {
      type: 'status_expire',
      attackerId: '',
      targetId: '',
      sequenceNumber: room.sequenceNumber,
      timestamp: now,
    }

    this._broadcastState(room, expiryEvent, io)
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private _socketForPlayer(room: ServerRoom, playerId: string): string | undefined {
    const localSocketId = room.socketIds['local']
    const remoteSocketId = room.socketIds['remote']
    if (room.localPlayer.id === playerId) return localSocketId
    if (room.remotePlayer.id === playerId) return remoteSocketId
    return undefined
  }

  private _stateForPlayer(room: ServerRoom, playerId: string): PlayerState | undefined {
    if (room.localPlayer.id === playerId) return room.localPlayer
    if (room.remotePlayer.id === playerId) return room.remotePlayer
    return undefined
  }

  private _broadcastState(room: ServerRoom, event: GameEvent, io: Server): void {
    const localSocketId = room.socketIds['local']
    const remoteSocketId = room.socketIds['remote']

    if (localSocketId) {
      io.to(localSocketId).emit(SOCKET_EVENTS.SERVER_BROADCAST, {
        event,
        localState: room.localPlayer,
        remoteState: room.remotePlayer,
        sequenceNumber: room.sequenceNumber,
      })
    }

    if (remoteSocketId) {
      io.to(remoteSocketId).emit(SOCKET_EVENTS.SERVER_BROADCAST, {
        event,
        localState: room.remotePlayer,
        remoteState: room.localPlayer,
        sequenceNumber: room.sequenceNumber,
      })
    }
  }
}

export const gameEngine = new GameEngine()