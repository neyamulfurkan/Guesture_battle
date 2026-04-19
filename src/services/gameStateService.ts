// src/services/gameStateService.ts
// Pure game logic: HP calculations, damage, status effects, combo validation.
// Zero networking imports — this file is logic only.

import {
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
  COMBO_WINDOW_MS,
  SERVER_MAX_HP,
  SERVER_WAR_CRY_DAMAGE_BONUS,
  DAMAGE_REFLECT_50_PCT,
} from '../lib/gameConstants'

import { POWER_DEFINITIONS } from '../lib/gameConstants.server'

import type {
  PowerId,
  GestureId,
  RoomState,
  RoomData,
  PlayerState,
  GameEvent,
  ComboState,
  StatusEffect,
} from '../types/game'

// ─── COOLDOWN MAP ─────────────────────────────────────────────────────────────

const POWER_COOLDOWNS: Record<PowerId, number> = {
  fire_punch: POWER_COOLDOWN_FIRE_PUNCH,
  shield: POWER_COOLDOWN_SHIELD,
  zap_shot: POWER_COOLDOWN_ZAP_SHOT,
  heal: POWER_COOLDOWN_HEAL,
  ice_freeze: POWER_COOLDOWN_ICE_FREEZE,
  double_strike: POWER_COOLDOWN_DOUBLE_STRIKE,
  thunder_smash: POWER_COOLDOWN_THUNDER_SMASH,
  force_push: POWER_COOLDOWN_FORCE_PUSH,
  dragon_blast: POWER_COOLDOWN_DRAGON_BLAST,
  reflect_dome: POWER_COOLDOWN_REFLECT_DOME,
  full_restore: POWER_COOLDOWN_REFLECT_DOME,
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function clampHp(hp: number): number {
  // SERVER_MAX_HP is imported from gameConstants — clamp uses the same value
  return Math.max(0, Math.min(SERVER_MAX_HP, hp))
}

function hasStatus(player: PlayerState, effect: StatusEffect): boolean {
  return player.statusEffects.includes(effect)
}

function applyStatus(
  player: PlayerState,
  effect: StatusEffect,
  durationMs: number,
  now: number
): PlayerState {
  const alreadyHas = hasStatus(player, effect)
  return {
    ...player,
    statusEffects: alreadyHas
      ? player.statusEffects
      : [...player.statusEffects, effect],
    statusTimers: {
      ...player.statusTimers,
      [effect]: now + durationMs,
    },
  }
}

function removeStatus(player: PlayerState, effect: StatusEffect): PlayerState {
  return {
    ...player,
    statusEffects: player.statusEffects.filter((e: StatusEffect) => e !== effect),
    statusTimers: Object.fromEntries(
      Object.entries(player.statusTimers).filter(([k]) => k !== effect)
    ) as Partial<Record<StatusEffect, number>>,
  }
}

// ─── EXPIRE STATUSES ──────────────────────────────────────────────────────────

export function expireStatuses(player: PlayerState, now: number): PlayerState {
  let updated = { ...player }
  for (const effect of [...player.statusEffects]) {
    const expiresAt = player.statusTimers[effect]
    if (expiresAt !== undefined && now >= expiresAt) {
      updated = removeStatus(updated, effect)
    }
  }
  return updated
}

// ─── CREATE INITIAL STATE ─────────────────────────────────────────────────────

export function createInitialPlayerState(
  id: string,
  displayName: string,
  unlockedPowers: PowerId[]
): PlayerState {
  return {
    id,
    displayName,
    hp: SERVER_MAX_HP,
    maxHp: 100,
    activePower: null,
    statusEffects: [],
    statusTimers: {},
    cooldowns: {},
    unlockedPowers,
    winStreak: 0,
    hasUsedFullRestore: false,
  }
}

// ─── VALIDATE ATTACK ─────────────────────────────────────────────────────────

export function validateAttack(
  playerState: PlayerState,
  power: PowerId,
  now: number
): { valid: boolean; reason?: string } {
  if (!playerState.unlockedPowers.includes(power)) {
    return { valid: false, reason: 'Power not unlocked.' }
  }

  if (hasStatus(playerState, 'stunned')) {
    return { valid: false, reason: 'Player is stunned and cannot attack.' }
  }

  if (hasStatus(playerState, 'frozen')) {
    return { valid: false, reason: 'Player is frozen and cannot attack.' }
  }

  const lastUsed = playerState.cooldowns[power]
  if (lastUsed !== undefined) {
    const elapsed = now - lastUsed
    const required = POWER_COOLDOWNS[power]
    if (elapsed < required) {
      return {
        valid: false,
        reason: `Power on cooldown. ${Math.ceil((required - elapsed) / 1000)}s remaining.`,
      }
    }
  }

  if (power === 'full_restore' && playerState.hasUsedFullRestore) {
    return { valid: false, reason: 'Full Restore can only be used once per battle.' }
  }

  return { valid: true }
}

// ─── IS ROOM STATE VALID ──────────────────────────────────────────────────────

export function isRoomStateValid(
  currentState: RoomState,
  forEvent: GameEvent['type']
): boolean {
  if (forEvent === 'game_end') return true
  return currentState === 'battle'
}

// ─── APPLY GAME EVENT ─────────────────────────────────────────────────────────

export function applyGameEvent(room: RoomData, event: GameEvent): RoomData {
  const now = event.timestamp

  // Identify attacker and target by ID
  const isLocalAttacker = room.localPlayer.id === event.attackerId
  let attacker: PlayerState = isLocalAttacker ? room.localPlayer : room.remotePlayer
  let target: PlayerState = isLocalAttacker ? room.remotePlayer : room.localPlayer

  const power = event.power

  if (event.type === 'game_end') {
    return { ...room, state: 'ended' }
  }

  if (event.type === 'heal' && power) {
    const healAmt = event.healAmount ?? 0
    attacker = {
      ...attacker,
      hp: clampHp(attacker.hp + healAmt),
      cooldowns: { ...attacker.cooldowns, [power]: now },
      hasUsedFullRestore:
        power === 'full_restore' ? true : attacker.hasUsedFullRestore,
    }
    // Apply healing status effect if defined
    const def = POWER_DEFINITIONS[power]
    if (def.effect && def.effectDurationMs) {
      attacker = applyStatus(attacker, def.effect, def.effectDurationMs, now)
    }
  } else if (event.type === 'attack' && power) {
    let damage = event.damage ?? 0

    // War cry bonus: if attacker has war_cry, increase damage
    if (hasStatus(attacker, 'war_cry')) {
      damage = Math.round(damage * (1 + SERVER_WAR_CRY_DAMAGE_BONUS))
      attacker = removeStatus(attacker, 'war_cry')
    }

    // Shield block: if target has shield, negate damage and remove shield
    if (hasStatus(target, 'shield')) {
      damage = 0
      target = removeStatus(target, 'shield')
    }

    // Reflect dome: if target has reflect, 50% damage returns to attacker
    let reflectDamage = 0
    if (hasStatus(target, 'reflect') && damage > 0) {
      reflectDamage = Math.round(damage * DAMAGE_REFLECT_50_PCT)
      damage = damage - reflectDamage
    }

    // Apply damage to target
    target = { ...target, hp: clampHp(target.hp - damage) }

    // Apply reflected damage to attacker
    if (reflectDamage > 0) {
      attacker = { ...attacker, hp: clampHp(attacker.hp - reflectDamage) }
    }

    // Apply status effect to target if defined
    const def = POWER_DEFINITIONS[power]
    if (def.effect && def.effectDurationMs && damage > 0) {
      target = applyStatus(target, def.effect, def.effectDurationMs, now)
    }

    // Update attacker's cooldown
    attacker = {
      ...attacker,
      cooldowns: { ...attacker.cooldowns, [power]: now },
    }
  } else if (event.type === 'defend' && power) {
    const def = POWER_DEFINITIONS[power]
    if (def.effect && def.effectDurationMs) {
      attacker = applyStatus(attacker, def.effect, def.effectDurationMs, now)
    }
    attacker = {
      ...attacker,
      cooldowns: { ...attacker.cooldowns, [power]: now },
    }
  } else if (event.type === 'status_apply' && event.status) {
    target = applyStatus(
      target,
      event.status,
      POWER_DEFINITIONS[power ?? 'shield']?.effectDurationMs ?? 2000,
      now
    )
  } else if (event.type === 'status_expire' && event.status) {
    target = removeStatus(target, event.status)
  }

  // Determine new room state
  const someoneDefeated = attacker.hp <= 0 || target.hp <= 0
  const newState: RoomState = someoneDefeated ? 'ended' : room.state

  // Reconstruct room with correct attacker/target positions
  const newLocal = isLocalAttacker ? attacker : target
  const newRemote = isLocalAttacker ? target : attacker

  return {
    ...room,
    state: newState,
    localPlayer: newLocal,
    remotePlayer: newRemote,
    sequenceNumber: event.sequenceNumber,
  }
}

// ─── GET COMBO PROGRESS ───────────────────────────────────────────────────────

export function getComboProgress(
  _sequence: GestureId[],
  gesture: GestureId,
  currentCombo: ComboState,
  now: number
): ComboState {
  // Check if the combo window has expired
  if (currentCombo.windowExpiresAt !== null && now > currentCombo.windowExpiresAt) {
    // Reset combo
    return {
      sequence: [],
      target: null,
      windowExpiresAt: null,
      voiceRequired: null,
    }
  }

  const newSequence = [...currentCombo.sequence, gesture]

  // Search all power definitions for a matching combo sequence
  for (const def of Object.values(POWER_DEFINITIONS) as import('../types/game').PowerDefinition[]) {
    if (!def.comboSequence || def.comboSequence.length === 0) continue

    const combo = def.comboSequence

    // Check if newSequence matches the start or entirety of this combo
    const matchLen = Math.min(newSequence.length, combo.length)
    const matches = combo
      .slice(0, matchLen)
      .every((g: string, i: number) => g === newSequence[i])

    if (!matches) continue

    if (newSequence.length === combo.length) {
      // Combo gesture sequence complete — voice may still be required
      return {
        sequence: newSequence,
        target: def.id,
        windowExpiresAt: now + COMBO_WINDOW_MS,
        voiceRequired: def.voiceKeyword ?? null,
      }
    }

    // Partial match — extend the window
    return {
      sequence: newSequence,
      target: null,
      windowExpiresAt: now + COMBO_WINDOW_MS,
      voiceRequired: null,
    }
  }

  // No combo matched — reset
  return {
    sequence: [],
    target: null,
    windowExpiresAt: null,
    voiceRequired: null,
  }
}

// ─── CLASS EXPORT (singleton-friendly) ───────────────────────────────────────

export class GameStateService {
  createInitialPlayerState = createInitialPlayerState
  applyGameEvent = applyGameEvent
  validateAttack = validateAttack
  getComboProgress = getComboProgress
  isRoomStateValid = isRoomStateValid
  expireStatuses = expireStatuses
}