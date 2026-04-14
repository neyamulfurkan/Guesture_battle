'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { SOCKET_EVENTS } from '@/lib/gameConstants.server'
import type { SocketRoomJoinPayload, SocketAttackPayload } from '@/types/game'

const JOIN_ROOM_TIMEOUT_MS = 8000

export function useSocket(): {
  socket: Socket | null
  isConnected: boolean
  joinRoom: (payload: SocketRoomJoinPayload) => Promise<void>
  rejoinRoom: (payload: SocketRoomJoinPayload) => Promise<void>
  emitGameEvent: (payload: SocketAttackPayload) => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
  off: (event: string, handler: (...args: unknown[]) => void) => void
} {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    if (!socketUrl) {
      console.error('NEXT_PUBLIC_SOCKET_URL is not defined')
      return
    }

    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket
    setSocket(socket)

    socket.on('connect', () => {
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [])

  const joinRoom = useCallback((payload: SocketRoomJoinPayload): Promise<void> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current
      if (!socket) {
        reject(new Error('Socket not initialized. Please refresh and try again.'))
        return
      }

      const timer = setTimeout(() => {
        reject(new Error('Could not join room — the server took too long to respond. Please try again.'))
      }, JOIN_ROOM_TIMEOUT_MS)

      socket.emit(SOCKET_EVENTS.JOIN_ROOM, payload, (response: { error?: string } | undefined) => {
        clearTimeout(timer)
        if (response?.error) {
          reject(new Error(response.error))
        } else {
          resolve()
        }
      })
    })
  }, [])

  const rejoinRoom = useCallback((payload: SocketRoomJoinPayload): Promise<void> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current
      if (!socket) {
        reject(new Error('Socket not initialized. Cannot rejoin room.'))
        return
      }

      const roomCode = sessionStorage.getItem('roomCode')
      const playerId = sessionStorage.getItem('playerId')

      const rejoinPayload: SocketRoomJoinPayload = {
        roomCode: payload.roomCode || roomCode || '',
        playerId: payload.playerId || playerId || '',
        displayName: payload.displayName,
      }

      const timer = setTimeout(() => {
        reject(new Error('Could not rejoin room — connection timed out. Your opponent may have left.'))
      }, JOIN_ROOM_TIMEOUT_MS)

      socket.emit(SOCKET_EVENTS.REJOIN_ROOM, rejoinPayload, (response: { error?: string } | undefined) => {
        clearTimeout(timer)
        if (response?.error) {
          reject(new Error(response.error))
        } else {
          resolve()
        }
      })
    })
  }, [])

  const emitGameEvent = useCallback((payload: SocketAttackPayload): void => {
    const socket = socketRef.current
    if (!socket || !socket.connected) return
    socket.emit(SOCKET_EVENTS.GAME_EVENT, payload)
  }, [])

  const on = useCallback((event: string, handler: (...args: unknown[]) => void): void => {
    socketRef.current?.on(event, handler)
  }, [])

  const off = useCallback((event: string, handler: (...args: unknown[]) => void): void => {
    socketRef.current?.off(event, handler)
  }, [])

  return {
    socket,
    isConnected,
    joinRoom,
    rejoinRoom,
    emitGameEvent,
    on,
    off,
  }
}