'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import {
  HP_RECONCILE_SNAP_THRESHOLD,
  COMBO_WINDOW_MS,
  COMBO_PERFORMANCE_EXTENSION_MS,
  ATTACK_PROJECTILE_DURATION_FIREBALL,
  ATTACK_PROJECTILE_DURATION_ZAP,
  ATTACK_FLOAT_TEXT_DURATION,
} from '@/lib/gameConstants'
import { SOCKET_EVENTS, POWER_DEFINITIONS } from '@/lib/gameConstants.server'
import {
  applyGameEvent,
  getComboProgress,
  validateAttack,
  isRoomStateValid,
} from '@/services/gameStateService'
import type {
  RoomData,
  AnimationState,
  PlayerState,
  GestureId,
  VoiceKeyword,
  FaceExpression,
  ComboState,
  PowerId,
  SocketServerBroadcast,
  SocketAttackPayload,
  Projectile,
  TileFilter,
  PlayerSide,
} from '@/types/game'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function makeTileFilter(): TileFilter {
  return { grayscale: 0, sepia: 0, hueRotate: 0, saturate: 1, brightness: 1, contrast: 1 }
}

function makeInitialAnimationState(): AnimationState {
  return {
    activeProjectiles: [],
    activeImpacts: [],
    floatingTexts: [],
    shakeAmplitude: { local: 0, remote: 0 },
    tileFilters: { local: makeTileFilter(), remote: makeTileFilter() },
    activeGestureActivation: null,
  }
}

function makeInitialComboState(): ComboState {
  return { sequence: [], target: null, windowExpiresAt: null, voiceRequired: null }
}

const GESTURE_TO_POWER_MAP: Partial<Record<GestureId, PowerId>> = {
  fist: 'fire_punch',
  open_palm: 'shield',
  index_point: 'zap_shot',
  shaka: 'heal',
}

function getProjectileDuration(power: PowerId): number {
  if (power === 'zap_shot') return ATTACK_PROJECTILE_DURATION_ZAP
  return ATTACK_PROJECTILE_DURATION_FIREBALL
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useGameState(
  socket: Socket | null,
  roomCode: string,
  localPlayerId: string
): {
  roomData: RoomData | null
  animationState: AnimationState
  localPlayerState: PlayerState | null
  remotePlayerState: PlayerState | null
  handleGesture: (gesture: GestureId, palmX?: number, palmY?: number) => void
  handleVoiceKeyword: (keyword: VoiceKeyword) => void
  handleFaceExpression: (expression: FaceExpression) => void
  comboState: ComboState
  sequenceNumber: number
} {
  const [roomData, setRoomData] = useState<RoomData | null>(() => {
    if (typeof window === 'undefined') return null
    return {
      code: roomCode,
      state: 'battle',
      localPlayer: {
        id: localPlayerId,
        displayName: 'You',
        hp: 100,
        maxHp: 100,
        activePower: null,
        statusEffects: [],
        statusTimers: {},
        cooldowns: {},
        unlockedPowers: ['fire_punch', 'shield', 'zap_shot', 'heal'],
        winStreak: 0,
        hasUsedFullRestore: false,
      },
      remotePlayer: {
        id: 'remote',
        displayName: 'Opponent',
        hp: 100,
        maxHp: 100,
        activePower: null,
        statusEffects: [],
        statusTimers: {},
        cooldowns: {},
        unlockedPowers: ['fire_punch', 'shield', 'zap_shot', 'heal'],
        winStreak: 0,
        hasUsedFullRestore: false,
      },
      sequenceNumber: 0,
    } as RoomData
  })
  const [animationState, setAnimationState] = useState<AnimationState>(makeInitialAnimationState())
  const [comboState, setComboState] = useState<ComboState>(makeInitialComboState())
  const [sequenceNumber, setSequenceNumber] = useState(0)

  const lastSeqRef = useRef(0)
  const seqCounterRef = useRef(0)
  const warCryActiveRef = useRef(false)
  const roomDataRef = useRef<RoomData | null>({
    code: roomCode,
    state: 'battle',
    localPlayer: {
      id: localPlayerId,
      displayName: 'You',
      hp: 100,
      maxHp: 100,
      activePower: null,
      statusEffects: [],
      statusTimers: {},
      cooldowns: {},
      unlockedPowers: ['fire_punch', 'shield', 'zap_shot', 'heal'],
      winStreak: 0,
      hasUsedFullRestore: false,
    },
    remotePlayer: {
      id: 'remote',
      displayName: 'Opponent',
      hp: 100,
      maxHp: 100,
      activePower: null,
      statusEffects: [],
      statusTimers: {},
      cooldowns: {},
      unlockedPowers: ['fire_punch', 'shield', 'zap_shot', 'heal'],
      winStreak: 0,
      hasUsedFullRestore: false,
    },
    sequenceNumber: 0,
  })
  const comboStateRef = useRef<ComboState>(makeInitialComboState())
  const animStateRef = useRef<AnimationState>(makeInitialAnimationState())

  // Keep refs in sync with state for use in callbacks
  useEffect(() => { roomDataRef.current = roomData }, [roomData])
  useEffect(() => { comboStateRef.current = comboState }, [comboState])
  useEffect(() => { animStateRef.current = animationState }, [animationState])

  // Persist roomCode and playerId for reconnection
  useEffect(() => {
    if (roomCode) sessionStorage.setItem('roomCode', roomCode)
    if (localPlayerId) sessionStorage.setItem('playerId', localPlayerId)
  }, [roomCode, localPlayerId])

  // ─── OPTIMISTIC ANIMATION HELPERS ──────────────────────────────────────────

  const addProjectile = useCallback((power: PowerId, fromSide: PlayerSide) => {
    const projectile: Projectile = {
      id: generateId(),
      type: power,
      fromSide,
      progress: 0,
      startTime: Date.now(),
      duration: getProjectileDuration(power),
    }
    setAnimationState((prev) => ({
      ...prev,
      activeProjectiles: [...prev.activeProjectiles, projectile],
    }))
    // Auto-remove after duration
    setTimeout(() => {
      setAnimationState((prev) => ({
        ...prev,
        activeProjectiles: prev.activeProjectiles.filter((p) => p.id !== projectile.id),
      }))
    }, projectile.duration + 100)
  }, [])

  const addImpact = useCallback((power: PowerId, targetSide: PlayerSide) => {
    const impact = {
      id: generateId(),
      type: power,
      side: targetSide,
      startTime: Date.now(),
    }
    setAnimationState((prev) => ({
      ...prev,
      activeImpacts: [...prev.activeImpacts, impact],
    }))
    setTimeout(() => {
      setAnimationState((prev) => ({
        ...prev,
        activeImpacts: prev.activeImpacts.filter((imp) => imp.id !== impact.id),
      }))
    }, 700)
  }, [])

  const addFloatingText = useCallback((text: string, targetSide: PlayerSide, canvasWidth: number, canvasHeight: number) => {
    const ft = {
      id: generateId(),
      text,
      side: targetSide,
      x: canvasWidth * 0.5,
      y: canvasHeight * 0.4,
      opacity: 1,
      startTime: Date.now(),
    }
    setAnimationState((prev) => ({
      ...prev,
      floatingTexts: [...prev.floatingTexts, ft],
    }))
    setTimeout(() => {
      setAnimationState((prev) => ({
        ...prev,
        floatingTexts: prev.floatingTexts.filter((f) => f.id !== ft.id),
      }))
    }, ATTACK_FLOAT_TEXT_DURATION + 100)
  }, [])

  const triggerShake = useCallback((side: PlayerSide, amplitude: number) => {
    setAnimationState((prev) => ({
      ...prev,
      shakeAmplitude: { ...prev.shakeAmplitude, [side]: amplitude },
    }))
    setTimeout(() => {
      setAnimationState((prev) => ({
        ...prev,
        shakeAmplitude: { ...prev.shakeAmplitude, [side]: 0 },
      }))
    }, 300)
  }, [])

  const triggerCorrectionFlash = useCallback((side: PlayerSide) => {
    setAnimationState((prev) => ({
      ...prev,
      tileFilters: {
        ...prev.tileFilters,
        [side]: { ...prev.tileFilters[side], brightness: 1.5 },
      },
    }))
    setTimeout(() => {
      setAnimationState((prev) => ({
        ...prev,
        tileFilters: {
          ...prev.tileFilters,
          [side]: { ...prev.tileFilters[side], brightness: 1 },
        },
      }))
    }, 150)
  }, [])

  // ─── SERVER BROADCAST HANDLER ───────────────────────────────────────────────

  const handleServerBroadcast = useCallback(
    (broadcast: SocketServerBroadcast) => {
      const { sequenceNumber: serverSeq, localState, remoteState, event } = broadcast

      // Reject out-of-order broadcasts
      if (serverSeq <= lastSeqRef.current) return
      lastSeqRef.current = serverSeq
      setSequenceNumber(serverSeq)

      // Determine sides based on attacker/target ids
      const attackerIsLocal = event.attackerId === localPlayerId
      const defenderIsLocal = event.targetId === localPlayerId
      const attackerSide: PlayerSide = attackerIsLocal ? 'local' : 'remote'
      const defenderSide: PlayerSide = defenderIsLocal ? 'local' : 'remote'

      // Trigger attack animations for BOTH local and remote attacks on server confirmation
      if (event.type === 'attack' && event.power) {
        // For remote attacker: add projectile AND gesture activation overlay on remote tile
        if (!attackerIsLocal) {
          addProjectile(event.power, attackerSide)
          // Show gesture activation effect on remote player's tile
          const remoteActivation = {
            gestureId: (POWER_DEFINITIONS[event.power as PowerId]?.gestureId ?? 'fist') as GestureId,
            powerId: event.power as PowerId,
            startTime: Date.now(),
            palmX: 0.5,
            palmY: 0.5,
            side: 'remote' as PlayerSide,
          }
          setAnimationState((prev) => ({
            ...prev,
            activeGestureActivation: remoteActivation,
          }))
          setTimeout(() => {
            setAnimationState((prev) => {
              if (prev.activeGestureActivation?.startTime === remoteActivation.startTime) {
                return { ...prev, activeGestureActivation: null }
              }
              return prev
            })
          }, 750)
        }
        // Impact always shown on defender tile for all attacks (server confirmed)
        setTimeout(() => {
          addImpact(event.power as PowerId, defenderSide)
        }, getProjectileDuration(event.power as PowerId))
        // Shake defender
        if (event.damage && event.damage > 0) {
          setTimeout(() => {
            triggerShake(defenderSide, 6)
          }, getProjectileDuration(event.power as PowerId))
          // Floating damage text on defender tile
          setTimeout(() => {
            addFloatingText(`-${event.damage} HP`, defenderSide, 400, 300)
          }, getProjectileDuration(event.power as PowerId))
        }
      }

      if (event.type === 'heal' && event.healAmount && event.healAmount > 0) {
addImpact('heal' as PowerId, attackerSide)
      addFloatingText(`+${event.healAmount} HP`, attackerSide, 400, 300)
      }

      setRoomData((prev) => {
        if (!prev) return prev
        const updatedRoom = applyGameEvent(prev, event)

        // HP reconciliation: if server HP diverges beyond threshold, snap with flash
        const localSide: PlayerSide = 'local'
        const remoteSide: PlayerSide = 'remote'

        const localHpDiff = Math.abs((localState?.hp ?? updatedRoom.localPlayer.hp) - updatedRoom.localPlayer.hp)
        const remoteHpDiff = Math.abs((remoteState?.hp ?? updatedRoom.remotePlayer.hp) - updatedRoom.remotePlayer.hp)

        let reconciledLocal = updatedRoom.localPlayer
        let reconciledRemote = updatedRoom.remotePlayer

        if (localHpDiff > HP_RECONCILE_SNAP_THRESHOLD && localState) {
          reconciledLocal = { ...updatedRoom.localPlayer, hp: localState.hp }
          triggerCorrectionFlash(localSide)
        }
        if (remoteHpDiff > HP_RECONCILE_SNAP_THRESHOLD && remoteState) {
          reconciledRemote = { ...updatedRoom.remotePlayer, hp: remoteState.hp }
          triggerCorrectionFlash(remoteSide)
        }

        return {
          ...updatedRoom,
          localPlayer: reconciledLocal,
          remotePlayer: reconciledRemote,
        }
      })
    },
    [localPlayerId, triggerCorrectionFlash, triggerShake, addProjectile, addImpact, addFloatingText]
  )

  // ─── SOCKET SUBSCRIPTIONS ──────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return

    const onBroadcast = (data: SocketServerBroadcast) => handleServerBroadcast(data)

    socket.on(SOCKET_EVENTS.SERVER_BROADCAST, onBroadcast)

    return () => {
      socket.off(SOCKET_EVENTS.SERVER_BROADCAST, onBroadcast)
    }
  }, [socket, handleServerBroadcast])

  // ─── EMIT ATTACK ───────────────────────────────────────────────────────────

  const emitAttack = useCallback(
    (power: PowerId) => {
      if (!socket) return
      const room = roomDataRef.current
      if (!room || !isRoomStateValid(room.state, 'attack')) return

      const localPlayer = room.localPlayer
      const now = Date.now()
      const { valid } = validateAttack(localPlayer, power, now)
      if (!valid) return

      seqCounterRef.current += 1
      const payload: SocketAttackPayload = {
        roomCode,
        playerId: localPlayerId,
        power,
        sequenceNumber: seqCounterRef.current,
        timestamp: now,
      }

      socket.emit(SOCKET_EVENTS.GAME_EVENT, payload)

      // Optimistically update cooldown so client-side validateAttack blocks duplicate sends
      setRoomData((prev) => {
        if (!prev) return prev
        const updated = {
          ...prev,
          localPlayer: {
            ...prev.localPlayer,
            cooldowns: {
              ...prev.localPlayer.cooldowns,
              [power]: now,
            },
          },
        }
        roomDataRef.current = updated
        return updated
      })

      // Optimistic animation
      addProjectile(power, 'local')
    },
    [socket, roomCode, localPlayerId, addProjectile]
  )

  // ─── HANDLE GESTURE ────────────────────────────────────────────────────────

  const handleGesture = useCallback(
    (gesture: GestureId, palmX?: number, palmY?: number) => {
      const now = Date.now()

      // Write gesture activation overlay onto animationState so canvas can draw it on the hand
      const mappedPower = GESTURE_TO_POWER_MAP[gesture] ?? null
      const activation = {
        gestureId: gesture,
        powerId: mappedPower,
        startTime: now,
        palmX: palmX ?? 0,
        palmY: palmY ?? 0,
        side: 'local' as PlayerSide,
      }
      setAnimationState((prev) => ({
        ...prev,
        activeGestureActivation: activation,
      }))
      // Auto-clear after animation duration (700ms matches drawGestureActivationOnHand duration)
      setTimeout(() => {
        setAnimationState((prev) => {
          if (prev.activeGestureActivation?.startTime === activation.startTime) {
            return { ...prev, activeGestureActivation: null }
          }
          return prev
        })
      }, 750)

      const currentCombo = comboStateRef.current

      // Attempt combo progression first
      const nextCombo = getComboProgress(currentCombo.sequence, gesture, currentCombo, now)
      comboStateRef.current = nextCombo
      setComboState(nextCombo)

      // If combo is complete with gestures (voice may still be required)
      if (nextCombo.target && !nextCombo.voiceRequired) {
        emitAttack(nextCombo.target)
        comboStateRef.current = makeInitialComboState()
        setComboState(makeInitialComboState())
        return
      }

      // If combo is in progress (partial), don't also fire a single-gesture power
      if (nextCombo.sequence.length > 1 || nextCombo.target) return

      // Single-gesture power mapping (Tier 1)
      const singlePower = GESTURE_TO_POWER_MAP[gesture]
      if (!singlePower) return

      const def = POWER_DEFINITIONS[singlePower]
      if (!def) return

      // Check if this gesture alone maps to a defend/heal type power
      if (def.effect === 'shield' || singlePower === 'shield') {
        const room = roomDataRef.current
        if (!room) return
        const localPlayer = room.localPlayer
        const actionTime = Date.now()
        const { valid } = validateAttack(localPlayer, singlePower, actionTime)
        if (!valid) return

        seqCounterRef.current += 1
        const payload: SocketAttackPayload = {
          roomCode,
          playerId: localPlayerId,
          power: singlePower,
          sequenceNumber: seqCounterRef.current,
          timestamp: actionTime,
        }
        socket?.emit(SOCKET_EVENTS.GAME_EVENT, payload)
        // Optimistically update cooldown
        const updatedRoom = { ...room, localPlayer: { ...room.localPlayer, cooldowns: { ...room.localPlayer.cooldowns, [singlePower]: actionTime } } }
        roomDataRef.current = updatedRoom
        setRoomData(updatedRoom)
        return
      }

      if (singlePower === 'heal') {
        const room = roomDataRef.current
        if (!room) return
        const localPlayer = room.localPlayer
        const actionTime = Date.now()
        const { valid } = validateAttack(localPlayer, singlePower, actionTime)
        if (!valid) return

        seqCounterRef.current += 1
        const payload: SocketAttackPayload = {
          roomCode,
          playerId: localPlayerId,
          power: singlePower,
          sequenceNumber: seqCounterRef.current,
          timestamp: actionTime,
        }
        socket?.emit(SOCKET_EVENTS.GAME_EVENT, payload)
        // Optimistically update cooldown
        const updatedRoom = { ...room, localPlayer: { ...room.localPlayer, cooldowns: { ...room.localPlayer.cooldowns, [singlePower]: actionTime } } }
        roomDataRef.current = updatedRoom
        setRoomData(updatedRoom)
        return
      }

      emitAttack(singlePower)
    },
    [emitAttack, roomCode, localPlayerId, socket]
  )

  // ─── HANDLE VOICE KEYWORD ──────────────────────────────────────────────────

  const handleVoiceKeyword = useCallback(
    (keyword: VoiceKeyword) => {
      const currentCombo = comboStateRef.current
      const now = Date.now()

      // Check if voice keyword completes a pending combo
      if (
        currentCombo.target &&
        currentCombo.voiceRequired === keyword &&
        currentCombo.windowExpiresAt !== null &&
        now < currentCombo.windowExpiresAt
      ) {
        emitAttack(currentCombo.target)
        comboStateRef.current = makeInitialComboState()
        setComboState(makeInitialComboState())
      }
    },
    [emitAttack]
  )

  // ─── HANDLE FACE EXPRESSION ────────────────────────────────────────────────

  const handleFaceExpression = useCallback(
    (expression: FaceExpression) => {
      if (expression === 'mouth_open') {
        // WAR_CRY hold logic is in FaceEngine — by the time we receive this event,
        // the hold threshold has been met. Set the war cry flag.
        warCryActiveRef.current = true
        // The war cry flag is communicated to the server as a status effect
        // applied via the next attack event. The server applies the damage bonus.
        // Optimistically update local animation state with war_cry status
        setRoomData((prev) => {
          if (!prev) return prev
          const hasWarCry = prev.localPlayer.statusEffects.includes('war_cry')
          if (hasWarCry) return prev
          return {
            ...prev,
            localPlayer: {
              ...prev.localPlayer,
              statusEffects: [...prev.localPlayer.statusEffects, 'war_cry'],
            },
          }
        })
      } else if (expression === 'eyebrows_raised') {
        // Cosmetic only — no gameplay effect
      } else if (expression === 'eyes_squinting') {
        // Extend active combo window
        const current = comboStateRef.current
        if (current.windowExpiresAt !== null) {
          const extended: ComboState = {
            ...current,
            windowExpiresAt: current.windowExpiresAt + COMBO_PERFORMANCE_EXTENSION_MS,
          }
          comboStateRef.current = extended
          setComboState(extended)
        }
      }
    },
    []
  )

  // ─── DERIVED STATE ─────────────────────────────────────────────────────────

  const localPlayerState = roomData
    ? roomData.localPlayer.id === localPlayerId
      ? roomData.localPlayer
      : roomData.remotePlayer
    : null

  const remotePlayerState = roomData
    ? roomData.localPlayer.id === localPlayerId
      ? roomData.remotePlayer
      : roomData.localPlayer
    : null

  return {
    roomData,
    animationState,
    localPlayerState,
    remotePlayerState,
    handleGesture,
    handleVoiceKeyword,
    handleFaceExpression,
    comboState,
    sequenceNumber,
  }
}