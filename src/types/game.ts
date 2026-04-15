// src/types/game.ts
// All shared game domain types and interfaces used across 3+ files in GestureBattle.

// ─── PRIMITIVE UNIONS ────────────────────────────────────────────────────────

export type PowerId =
  | 'fire_punch'
  | 'shield'
  | 'zap_shot'
  | 'heal'
  | 'ice_freeze'
  | 'double_strike'
  | 'thunder_smash'
  | 'force_push'
  | 'dragon_blast'
  | 'reflect_dome'
  | 'full_restore'

export type GestureId =
  | 'fist'
  | 'open_palm'
  | 'index_point'
  | 'peace_sign'
  | 'shaka'
  | 'thumbs_up'
  | 'thumbs_down'
  | 'flat_palm'
  | 'crossed_fingers'
  | 'wrist_spin'
  | 'both_hands_push'
  | 'both_hands_open'
  | 'swipe_left'
  | 'swipe_right'

export type VoiceKeyword = 'FIRE' | 'NOW' | 'ULTIMATE' | 'SHIELD' | 'GO' | 'STOP'

export type PlayerSide = 'local' | 'remote'

export type RoomState = 'waiting' | 'ready' | 'battle' | 'ended'

export type StatusEffect =
  | 'shield'
  | 'burning'
  | 'stunned'
  | 'frozen'
  | 'healing'
  | 'reflect'
  | 'war_cry'
  | 'focus'

export type PowerTier = 1 | 2 | 3

export type FaceExpression = 'mouth_open' | 'eyebrows_raised' | 'eyes_squinting'

// ─── INTERFACES ──────────────────────────────────────────────────────────────

export interface PowerDefinition {
  id: PowerId
  name: string
  tier: PowerTier
  gestureId: GestureId
  voiceKeyword?: VoiceKeyword
  comboSequence?: GestureId[]
  damage?: number
  healAmount?: number
  cooldownMs: number
  effect?: StatusEffect
  effectDurationMs?: number
  description: string
}

export interface PlayerState {
  id: string
  displayName: string
  hp: number
  maxHp: 100
  activePower: PowerId | null
  statusEffects: StatusEffect[]
  statusTimers: Partial<Record<StatusEffect, number>>
  cooldowns: Partial<Record<PowerId, number>>
  unlockedPowers: PowerId[]
  winStreak: number
  hasUsedFullRestore: boolean
}

export interface RoomData {
  code: string
  state: RoomState
  localPlayer: PlayerState
  remotePlayer: PlayerState
  sequenceNumber: number
}

export interface GameEvent {
  type: 'attack' | 'defend' | 'heal' | 'status_apply' | 'status_expire' | 'game_end'
  power?: PowerId
  attackerId: string
  targetId: string
  damage?: number
  healAmount?: number
  status?: StatusEffect
  sequenceNumber: number
  timestamp: number
}

export interface ComboState {
  sequence: GestureId[]
  target: PowerId | null
  windowExpiresAt: number | null
  voiceRequired: VoiceKeyword | null
}

export interface TileFilter {
  grayscale: number
  sepia: number
  hueRotate: number
  saturate: number
  brightness: number
  contrast: number
}

export interface Projectile {
  id: string
  type: PowerId
  fromSide: PlayerSide
  progress: number
  startTime: number
  duration: number
}

export interface Impact {
  id: string
  type: PowerId
  side: PlayerSide
  startTime: number
}

export interface FloatingText {
  id: string
  text: string
  side: PlayerSide
  x: number
  y: number
  opacity: number
  startTime: number
}

export interface GestureActivation {
  gestureId: GestureId
  powerId: PowerId | null
  startTime: number
  palmX: number
  palmY: number
  side: PlayerSide
}

export interface AnimationState {
  activeProjectiles: Projectile[]
  activeImpacts: Impact[]
  floatingTexts: FloatingText[]
  shakeAmplitude: Record<PlayerSide, number>
  tileFilters: Record<PlayerSide, TileFilter>
  activeGestureActivation: GestureActivation | null
}

export interface ToastMessage {
  id: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  duration: number
}

export interface GameSettings {
  gestureSensitivity: 'low' | 'normal' | 'high'
  voiceDetection: boolean
  faceExpressions: boolean
  sfxVolume: number
  showHandSkeleton: boolean
  showPowerTooltips: boolean
  gestureNavigation: boolean
  touchControls: boolean
}

// ─── SOCKET PAYLOAD INTERFACES ───────────────────────────────────────────────

export interface SocketRoomJoinPayload {
  roomCode: string
  playerId: string
  displayName: string
}

export interface SocketAttackPayload {
  roomCode: string
  playerId: string
  power: PowerId
  sequenceNumber: number
  timestamp: number
}

export interface SocketServerBroadcast {
  event: GameEvent
  localState: PlayerState
  remoteState: PlayerState
  sequenceNumber: number
}