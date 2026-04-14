'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import { ICE_SERVERS, SOCKET_EVENTS } from '@/lib/gameConstants.server'
import type { GameEvent, SocketAttackPayload } from '@/types/game'

const GET_USER_MEDIA_TIMEOUT_MS = 10_000
const WEBRTC_CONNECTION_TIMEOUT_MS = 30_000
const ICE_DISCONNECT_RESTART_DELAY_MS = 5_000

function modifySDP(sdp: string): string {
  const lines = sdp.split('\r\n')
  const result: string[] = []
  let inVideoSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('m=video')) {
      inVideoSection = true
      result.push(line)
      continue
    }
    if (line.startsWith('m=') && !line.startsWith('m=video')) {
      inVideoSection = false
    }
    if (inVideoSection && line.startsWith('c=')) {
      result.push(line)
      result.push('b=AS:500')
      continue
    }
    result.push(line)
  }

  return result.join('\r\n')
}

export function useWebRTC(socket: Socket | null): {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  dataChannel: RTCDataChannel | null
  connectionState: RTCIceConnectionState
  isUsingFallback: boolean
  initiate: (isInitiator: boolean) => Promise<void>
  sendGameEvent: (event: GameEvent) => void
  cleanup: () => void
} {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackToSocketRef = useRef(false)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null)
  const [connectionState, setConnectionState] = useState<RTCIceConnectionState>('new')
  const [isUsingFallback, setIsUsingFallback] = useState(false)

  const emitGameEvent = useCallback(
    (payload: SocketAttackPayload) => {
      socket?.emit(SOCKET_EVENTS.GAME_EVENT, payload)
    },
    [socket]
  )

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dataChannelRef.current = dc

    dc.onopen = () => {
      setDataChannel(dc)
    }

    dc.onclose = () => {
      setDataChannel(null)
    }

    dc.onerror = () => {
      fallbackToSocketRef.current = true
      setIsUsingFallback(true)
    }
  }, [])

  const cleanup = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current)
      disconnectTimerRef.current = null
    }
    if (connectionTimerRef.current) {
      clearTimeout(connectionTimerRef.current)
      connectionTimerRef.current = null
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    setLocalStream(null)
    setRemoteStream(null)
    setDataChannel(null)
    setConnectionState('new')
    fallbackToSocketRef.current = false
    setIsUsingFallback(false)
  }, [])

  const initiate = useCallback(
    async (isInitiator: boolean): Promise<void> => {
      if (!socket) throw new Error('Socket not connected. Please refresh and try again.')

      // ── Get user media ──────────────────────────────────────────────────────
      const stream = await new Promise<MediaStream>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Camera access timed out. Check that your camera is connected and try again.'))
        }, GET_USER_MEDIA_TIMEOUT_MS)

        const attemptGetUserMedia = (attemptsLeft: number) => {
          navigator.mediaDevices
          .getUserMedia({
            video: { width: 640, height: 480, frameRate: 30 },
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
          })
          .then((s) => {
            clearTimeout(timer)
            resolve(s)
          })
          .catch((err: Error) => {
            if (err.name === 'NotReadableError' && attemptsLeft > 0) {
              // Camera may still be releasing from previous page — retry after 500ms
              setTimeout(() => attemptGetUserMedia(attemptsLeft - 1), 500)
              return
            }
            clearTimeout(timer)
            if (err.name === 'NotAllowedError') {
              reject(new Error('Camera access was denied. Allow camera and microphone access in your browser settings and try again.'))
            } else if (err.name === 'NotFoundError') {
              reject(new Error('No camera found. Plug in a camera or check that your built-in camera is working.'))
            } else if (err.name === 'NotReadableError') {
              reject(new Error('Your camera is being used by another app. Close Zoom, Teams, or other apps using your camera and try again.'))
            } else {
              reject(new Error(`Camera error: ${err.message}`))
            }
          })
        }
        attemptGetUserMedia(5)
      })

      localStreamRef.current = stream
      setLocalStream(stream)

      // ── Create peer connection ──────────────────────────────────────────────
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcRef.current = pc

      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      // ── Remote stream ──────────────────────────────────────────────────────
      const remoteMediaStream = new MediaStream()
      setRemoteStream(remoteMediaStream)

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          remoteMediaStream.addTrack(track)
        })
        setRemoteStream(new MediaStream(remoteMediaStream.getTracks()))
      }

      // ── DataChannel (initiator creates, receiver receives) ─────────────────
      if (isInitiator) {
        const dc = pc.createDataChannel('game', { ordered: true, maxRetransmits: 3 })
        setupDataChannel(dc)
      } else {
        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel)
        }
      }

      // ── ICE candidates → socket ────────────────────────────────────────────
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit(SOCKET_EVENTS.SIGNAL_ICE, { candidate: event.candidate, roomCode: sessionStorage.getItem('roomCode') ?? '' })
        }
      }

      // ── ICE connection state ───────────────────────────────────────────────
pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState
        setConnectionState(state)

        if (state === 'disconnected') {
          disconnectTimerRef.current = setTimeout(() => {
            pcRef.current?.restartIce()
          }, ICE_DISCONNECT_RESTART_DELAY_MS)
        } else if (state === 'connected' || state === 'completed') {
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current)
            disconnectTimerRef.current = null
          }
          if (connectionTimerRef.current) {
            clearTimeout(connectionTimerRef.current)
            connectionTimerRef.current = null
          }
        } else if (state === 'failed') {
          // Attempt ICE restart first — TURN servers may establish relay after restart
          pcRef.current?.restartIce()
        } else if (state === 'closed') {
          socket.emit('connectionClosed')
        }
      }

      // ── Negotiation (SDP offer/answer) ─────────────────────────────────────
      // Initiator manually triggers offer after peer_ready — onnegotiationneeded disabled
      pc.onnegotiationneeded = async () => {
        // Intentionally empty — offer is triggered manually below for initiator
      }

      // ── Receive offer (non-initiator) ──────────────────────────────────────
const handleOffer = async (data: { offer: RTCSessionDescriptionInit }) => {
if (!pcRef.current) return
try {
await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer))
          const answer = await pcRef.current.createAnswer()
          const modifiedSDP = modifySDP(answer.sdp ?? '')
          await pcRef.current.setLocalDescription({ type: answer.type, sdp: modifiedSDP })
          socket.emit(SOCKET_EVENTS.SIGNAL_ANSWER, { answer: pcRef.current.localDescription, roomCode: sessionStorage.getItem('roomCode') ?? '' })
        } catch (err) {
          console.error('Failed to handle offer:', err)
        }
      }

      // ── Receive answer (initiator) ─────────────────────────────────────────
const handleAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
if (!pcRef.current) return
try {
await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
        } catch (err) {
          console.error('Failed to handle answer:', err)
        }
      }

      // ── Receive ICE candidates ─────────────────────────────────────────────
      const handleICE = async (data: { candidate: RTCIceCandidateInit }) => {
        if (!pcRef.current) return
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch (err) {
          console.error('Failed to add ICE candidate:', err)
        }
      }

socket.on(SOCKET_EVENTS.SIGNAL_OFFER, handleOffer)
socket.on(SOCKET_EVENTS.SIGNAL_ANSWER, handleAnswer)
socket.on(SOCKET_EVENTS.SIGNAL_ICE, handleICE)
socket.emit('peer_ready', { roomCode: sessionStorage.getItem('roomCode') ?? '' })
      // Initiator sends offer after receiving peer_ready from non-initiator
      // Non-initiator just waits for the offer
      if (isInitiator) {
        let offerSent = false
        const sendOffer = async () => {
          if (offerSent) return
          offerSent = true
          try {
            const offer = await pc.createOffer()
            const modifiedSDP = modifySDP(offer.sdp ?? '')
            await pc.setLocalDescription({ type: offer.type, sdp: modifiedSDP })
            socket.emit(SOCKET_EVENTS.SIGNAL_OFFER, {
              offer: pc.localDescription,
              roomCode: sessionStorage.getItem('roomCode') ?? '',
            })
          } catch (err) {
            console.error('Offer creation failed:', err)
          }
        }
const handlePeerReady = () => {
          socket.off('peer_ready', handlePeerReady)
          sendOffer()
        }
        socket.on('peer_ready', handlePeerReady)
        setTimeout(() => {
          socket.off('peer_ready', handlePeerReady)
          sendOffer()
        }, 3000)
      }

      // ── Connection timeout ─────────────────────────────────────────────────
      // Only fall back game DATA to socket if WebRTC data channel never opened.
      // Video has no socket fallback — if ICE fails, opponent video stays black.
      connectionTimerRef.current = setTimeout(() => {
        const state = pcRef.current?.iceConnectionState
        if (state !== 'connected' && state !== 'completed') {
          // Data channel fallback only — socket relay handles game events
          if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
            fallbackToSocketRef.current = true
            setIsUsingFallback(true)
          }
        }
      }, WEBRTC_CONNECTION_TIMEOUT_MS)
    },
    [socket, setupDataChannel, emitGameEvent]
  )

  const sendGameEvent = useCallback(
    (event: GameEvent) => {
      if (fallbackToSocketRef.current || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
        // Fallback to socket — construct minimal payload from event
        const payload: SocketAttackPayload = {
          roomCode: sessionStorage.getItem('roomCode') ?? '',
          playerId: sessionStorage.getItem('playerId') ?? '',
          power: event.power ?? 'fire_punch',
          sequenceNumber: event.sequenceNumber,
          timestamp: event.timestamp,
        }
        emitGameEvent(payload)
        return
      }
      try {
        dataChannelRef.current.send(JSON.stringify(event))
      } catch {
        fallbackToSocketRef.current = true
        setIsUsingFallback(true)
        const payload: SocketAttackPayload = {
          roomCode: sessionStorage.getItem('roomCode') ?? '',
          playerId: sessionStorage.getItem('playerId') ?? '',
          power: event.power ?? 'fire_punch',
          sequenceNumber: event.sequenceNumber,
          timestamp: event.timestamp,
        }
        emitGameEvent(payload)
      }
    },
    [emitGameEvent]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    localStream,
    remoteStream,
    dataChannel,
    connectionState,
    isUsingFallback,
    initiate,
    sendGameEvent,
    cleanup,
  }
}