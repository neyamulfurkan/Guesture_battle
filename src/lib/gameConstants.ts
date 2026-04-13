// src/lib/gameConstants.ts
// Central repository for all game timing values, thresholds, and measurements.
// Edit ONLY this file when balancing the game.

// ─── GESTURE ─────────────────────────────────────────────────────────────────
export const GESTURE_HOLD_FRAMES_SHIELD = 24
export const GESTURE_HOLD_FRAMES_PUNCH = 3
export const GESTURE_HOLD_FRAMES_ZAP = 3
export const GESTURE_HOLD_FRAMES_HEAL = 5
export const GESTURE_DETECT_FPS = 30
export const GESTURE_INTERVAL_MS = 33
export const GESTURE_DEBOUNCE_MS = 800
export const GESTURE_RETICLE_DWELL_MS = 1200
export const GESTURE_SWIPE_MIN_PX = 120
export const GESTURE_SWIPE_MAX_FRAMES = 8
export const GESTURE_PALM_PUSH_AREA_INCREASE = 0.15
export const GESTURE_PALM_PUSH_FRAMES = 5
export const GESTURE_WRIST_SPIN_MIN_RADIUS = 40
export const GESTURE_WRIST_SPIN_FRAMES = 10

// ─── COMBO ────────────────────────────────────────────────────────────────────
export const COMBO_WINDOW_MS = 1800
export const COMBO_VOICE_TIMEOUT_MS = 1800
export const COMBO_PERFORMANCE_EXTENSION_MS = 300

// ─── ATTACK ───────────────────────────────────────────────────────────────────
export const ATTACK_COOLDOWN_BASE_MS = 800
export const ATTACK_PROJECTILE_DURATION_FIREBALL = 500
export const ATTACK_PROJECTILE_DURATION_ZAP = 300
export const ATTACK_IMPACT_FLASH_MS = 100
export const ATTACK_FLOAT_TEXT_DURATION = 1000
export const ATTACK_FLOAT_TEXT_RISE_PX = 40

// ─── POWER COOLDOWNS ─────────────────────────────────────────────────────────
export const POWER_COOLDOWN_FIRE_PUNCH = 2000
export const POWER_COOLDOWN_SHIELD = 5000
export const POWER_COOLDOWN_ZAP_SHOT = 1500
export const POWER_COOLDOWN_HEAL = 8000
export const POWER_COOLDOWN_ICE_FREEZE = 4000
export const POWER_COOLDOWN_DOUBLE_STRIKE = 3000
export const POWER_COOLDOWN_THUNDER_SMASH = 6000
export const POWER_COOLDOWN_FORCE_PUSH = 5000
export const POWER_COOLDOWN_DRAGON_BLAST = 10000
export const POWER_COOLDOWN_REFLECT_DOME = 12000

// ─── DAMAGE & HEALING ────────────────────────────────────────────────────────
export const DAMAGE_FIRE_PUNCH = 20
export const DAMAGE_ZAP_SHOT = 15
export const DAMAGE_ICE_FREEZE = 20
export const DAMAGE_DOUBLE_STRIKE = 18
export const DAMAGE_THUNDER_SMASH = 30
export const DAMAGE_FORCE_PUSH = 25
export const DAMAGE_DRAGON_BLAST = 50
export const DAMAGE_REFLECT_50_PCT = 0.5
export const HEAL_AMOUNT_HEAL = 15
export const HEAL_AMOUNT_FULL_RESTORE = 100
export const HEAL_AMOUNT_SHIELD_VOICE = 10

// ─── PARTICLES ───────────────────────────────────────────────────────────────
export const MAX_FIRE_PARTICLES = 60
export const MAX_LIGHTNING_PARTICLES = 40
export const MAX_HEALING_PARTICLES = 30
export const BACKGROUND_PARTICLE_COUNT_DESKTOP = 80
export const BACKGROUND_PARTICLE_COUNT_MOBILE = 40

// ─── TIMING ───────────────────────────────────────────────────────────────────
export const RECONNECT_WINDOW_MS = 15000
export const ROOM_GC_ENDED_MS = 300000
export const ROOM_GC_WAITING_MS = 600000
export const ROOM_GC_INTERVAL_MS = 60000
export const COUNTDOWN_START = 5
export const DODGE_SUCCESS_PROBABILITY = 0.6
export const PARRY_WINDOW_MS = 400
export const SHIELD_BLOCK_DURATION_FRAMES = 24
export const STATUS_STUN_DURATION_MS = 2000
export const STATUS_FREEZE_DURATION_MS = 2000
export const STATUS_REFLECT_DURATION_MS = 3000

// ─── CANVAS ───────────────────────────────────────────────────────────────────
export const CANVAS_TARGET_FPS = 60
export const CANVAS_FRAME_TIME_WARN = 20
export const CANVAS_FRAME_TIME_CRITICAL = 33
export const CANVAS_PERFORMANCE_SAMPLE_FRAMES = 10
export const SHAKE_CYCLES_NORMAL = 3
export const SHAKE_CYCLES_CRITICAL = 5
export const SHAKE_AMPLITUDE_PX = 6

// ─── VOICE ────────────────────────────────────────────────────────────────────
export const VOICE_CONFIDENCE_THRESHOLD = 0.75
export const VOICE_RESTART_DELAY_MS = 100
export const VOICE_KEYWORD_COOLDOWN_MS = 2000
export const VOICE_SFX_MUTE_DURATION_MS = 400
export const VOICE_SFX_TRIGGER_LENGTH_MS = 300

// ─── SERVER ───────────────────────────────────────────────────────────────────
export const SERVER_RATE_LIMIT_ATTACK_MS = 800
export const SERVER_MAX_HP = 100
export const SERVER_WAR_CRY_DAMAGE_BONUS = 0.1
export const SERVER_FOCUS_COMBO_EXTENSION_MS = 300

// ─── THRESHOLDS ───────────────────────────────────────────────────────────────
export const MEDIAPIPE_MIN_DETECTION_CONFIDENCE = 0.8
export const MEDIAPIPE_MIN_TRACKING_CONFIDENCE = 0.7
export const MEDIAPIPE_MAX_NUM_HANDS = 2
export const MEDIAPIPE_SLOW_DEVICE_TOTAL_MS = 2000
export const MEDIAPIPE_SLOW_DEVICE_FRAMES = 30
export const BRIGHTNESS_LOW_THRESHOLD = 60
export const BRIGHTNESS_CHECK_INTERVAL_MS = 2000
export const BRIGHTNESS_TOAST_COOLDOWN_MS = 60000
export const HP_RECONCILE_SNAP_THRESHOLD = 10
export const HP_LOW_THRESHOLD = 25
export const HP_CRITICAL_VIGNETTE_THRESHOLD = 50