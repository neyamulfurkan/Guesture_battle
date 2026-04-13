// src/lib/gameConstants.server.ts
// Re-exports all client constants and adds server-only constants:
// ICE server configs, socket event name map, and full power definitions.

export * from './gameConstants'

import type { PowerDefinition, PowerId } from '../types/game'
import {
  DAMAGE_FIRE_PUNCH,
  DAMAGE_ZAP_SHOT,
  DAMAGE_ICE_FREEZE,
  DAMAGE_DOUBLE_STRIKE,
  DAMAGE_THUNDER_SMASH,
  DAMAGE_FORCE_PUSH,
  DAMAGE_DRAGON_BLAST,
  HEAL_AMOUNT_HEAL,
  HEAL_AMOUNT_FULL_RESTORE,
  POWER_COOLDOWN_FIRE_PUNCH,
  POWER_COOLDOWN_SHIELD,
  POWER_COOLDOWN_ZAP_SHOT,
  POWER_COOLDOWN_HEAL,
  POWER_COOLDOWN_ICE_FREEZE,
  POWER_COOLDOWN_DOUBLE_STRIKE,
  POWER_COOLDOWN_THUNDER_SMASH,
  POWER_COOLDOWN_FORCE_PUSH,
  POWER_COOLDOWN_DRAGON_BLAST,
  POWER_COOLDOWN_REFLECT_DOME,
  STATUS_STUN_DURATION_MS,
  STATUS_FREEZE_DURATION_MS,
  STATUS_REFLECT_DURATION_MS,
} from './gameConstants'

// ─── ICE SERVERS ─────────────────────────────────────────────────────────────

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

// ─── SOCKET EVENTS ───────────────────────────────────────────────────────────

export const SOCKET_EVENTS = {
  JOIN_ROOM: 'join_room',
  REJOIN_ROOM: 'rejoin_room',
  LEAVE_ROOM: 'leave_room',
  GAME_EVENT: 'game_event',
  SERVER_BROADCAST: 'server_broadcast',
  ROOM_STATE_CHANGE: 'room_state_change',
  OPPONENT_DISCONNECTED: 'opponent_disconnected',
  OPPONENT_RECONNECTED: 'opponent_reconnected',
  BATTLE_PAUSE: 'battle_pause',
  BATTLE_RESUME: 'battle_resume',
  SIGNAL_OFFER: 'signal_offer',
  SIGNAL_ANSWER: 'signal_answer',
  SIGNAL_ICE: 'signal_ice',
  RATE_LIMITED: 'rate_limited',
  ERROR: 'socket_error',
} as const

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS]

// ─── POWER DEFINITIONS ───────────────────────────────────────────────────────

export const POWER_DEFINITIONS: Record<PowerId, PowerDefinition> = {
  fire_punch: {
    id: 'fire_punch',
    name: 'Fire Punch',
    tier: 1,
    gestureId: 'fist',
    damage: DAMAGE_FIRE_PUNCH,
    cooldownMs: POWER_COOLDOWN_FIRE_PUNCH,
    description: 'Close your fist to hurl a blazing punch at your opponent.',
  },

  shield: {
    id: 'shield',
    name: 'Shield',
    tier: 1,
    gestureId: 'open_palm',
    cooldownMs: POWER_COOLDOWN_SHIELD,
    effect: 'shield',
    effectDurationMs: 2000,
    description: 'Hold an open palm to erect a defensive energy shield.',
  },

  zap_shot: {
    id: 'zap_shot',
    name: 'Zap Shot',
    tier: 1,
    gestureId: 'index_point',
    damage: DAMAGE_ZAP_SHOT,
    cooldownMs: POWER_COOLDOWN_ZAP_SHOT,
    description: 'Point your index finger to fire a lightning bolt.',
  },

  heal: {
    id: 'heal',
    name: 'Heal',
    tier: 1,
    gestureId: 'shaka',
    healAmount: HEAL_AMOUNT_HEAL,
    cooldownMs: POWER_COOLDOWN_HEAL,
    effect: 'healing',
    effectDurationMs: 1500,
    description: 'Flash the shaka sign to channel restorative energy.',
  },

  ice_freeze: {
    id: 'ice_freeze',
    name: 'Ice Freeze',
    tier: 2,
    gestureId: 'peace_sign',
    damage: DAMAGE_ICE_FREEZE,
    cooldownMs: POWER_COOLDOWN_ICE_FREEZE,
    effect: 'frozen',
    effectDurationMs: STATUS_FREEZE_DURATION_MS,
    description: 'Flash a tilted peace sign to encase your opponent in ice.',
  },

  double_strike: {
    id: 'double_strike',
    name: 'Double Strike',
    tier: 2,
    gestureId: 'crossed_fingers',
    damage: DAMAGE_DOUBLE_STRIKE,
    cooldownMs: POWER_COOLDOWN_DOUBLE_STRIKE,
    description: 'Cross your fingers and flick to deliver two rapid blows.',
  },

  thunder_smash: {
    id: 'thunder_smash',
    name: 'Thunder Smash',
    tier: 2,
    gestureId: 'fist',
    voiceKeyword: 'NOW',
    comboSequence: ['fist'],
    damage: DAMAGE_THUNDER_SMASH,
    cooldownMs: POWER_COOLDOWN_THUNDER_SMASH,
    effect: 'stunned',
    effectDurationMs: STATUS_STUN_DURATION_MS,
    description: 'Make a fist then shout "NOW!" to summon a massive thunderbolt.',
  },

  force_push: {
    id: 'force_push',
    name: 'Force Push',
    tier: 2,
    gestureId: 'both_hands_push',
    damage: DAMAGE_FORCE_PUSH,
    cooldownMs: POWER_COOLDOWN_FORCE_PUSH,
    description: 'Push both palms toward the camera to blast your opponent back.',
  },

  dragon_blast: {
    id: 'dragon_blast',
    name: 'Dragon Blast',
    tier: 3,
    gestureId: 'fist',
    voiceKeyword: 'FIRE',
    comboSequence: ['fist', 'index_point'],
    damage: DAMAGE_DRAGON_BLAST,
    cooldownMs: POWER_COOLDOWN_DRAGON_BLAST,
    description: 'Fist → point → shout "FIRE!" to unleash a devastating dragon inferno.',
  },

  reflect_dome: {
    id: 'reflect_dome',
    name: 'Reflect Dome',
    tier: 3,
    gestureId: 'open_palm',
    comboSequence: ['open_palm', 'peace_sign', 'wrist_spin'],
    cooldownMs: POWER_COOLDOWN_REFLECT_DOME,
    effect: 'reflect',
    effectDurationMs: STATUS_REFLECT_DURATION_MS,
    description: 'Shield → peace → wrist spin to create a dome that reflects 50% of damage.',
  },

  full_restore: {
    id: 'full_restore',
    name: 'Full Restore',
    tier: 3,
    gestureId: 'shaka',
    voiceKeyword: 'ULTIMATE',
    comboSequence: ['shaka', 'both_hands_open'],
    healAmount: HEAL_AMOUNT_FULL_RESTORE,
    cooldownMs: POWER_COOLDOWN_REFLECT_DOME,
    description: 'Shaka → both hands open → shout "ULTIMATE!" to fully restore your HP.',
  },
}