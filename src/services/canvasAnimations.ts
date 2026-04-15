// src/services/canvasAnimations.ts
// Pure Canvas 2D draw functions for all GestureBattle attack animations, impacts, overlays, and text.
// No side effects. No state mutations. No socket calls.

import {
  ATTACK_FLOAT_TEXT_DURATION,
  ATTACK_FLOAT_TEXT_RISE_PX,
  ATTACK_IMPACT_FLASH_MS,
  ATTACK_PROJECTILE_DURATION_FIREBALL,
  ATTACK_PROJECTILE_DURATION_ZAP,
  SHAKE_AMPLITUDE_PX,
} from '@/lib/gameConstants'
import type { FloatingText, Impact, PlayerSide, Projectile } from '@/types/game'
import { clamp, easeOutCubic, easeOutQuad, lerp } from '@/lib/utils'

// ─── LOCAL PARTICLE TYPE (canvas-only, not shared game state) ────────────────

export interface CanvasParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  color: string
  lifetime: number
  age: number
}

// ─── FIREBALL ─────────────────────────────────────────────────────────────────

export function drawFireball(
  ctx: CanvasRenderingContext2D,
  projectile: Projectile,
  canvasWidth: number,
  canvasHeight: number,
  now: number
): void {
  ctx.save()

  const elapsed = now - projectile.startTime
  const rawT = clamp(elapsed / projectile.duration, 0, 1)
  const t = easeOutQuad(rawT)

  // Travel from left edge to right edge (local player always left)
  const fromX = projectile.fromSide === 'local' ? 0 : canvasWidth
  const toX = projectile.fromSide === 'local' ? canvasWidth : 0
  const x = lerp(fromX, toX, t)
  const y = canvasHeight * 0.5

  const RADIUS = 20

  // Trail particles
  const trailCount = 12
  for (let i = 0; i < trailCount; i++) {
    const trailT = clamp(t - i * 0.025, 0, 1)
    const trailX = lerp(fromX, toX, easeOutQuad(trailT))
    const trailOpacity = (1 - i / trailCount) * 0.6 * (1 - rawT)
    const trailRadius = RADIUS * (1 - i / trailCount) * 0.7
    ctx.save()
    ctx.globalAlpha = trailOpacity
    ctx.beginPath()
    ctx.arc(trailX, y, trailRadius, 0, Math.PI * 2)
    ctx.fillStyle = '#f97316'
    ctx.fill()
    ctx.restore()
  }

  // Core glow
  ctx.save()
  ctx.shadowColor = '#f97316'
  ctx.shadowBlur = 24

  // 8 flame petals
  const petalCount = 8
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2 + now * 0.005
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(
      RADIUS * 0.4, -RADIUS * 0.3,
      RADIUS * 0.6, -RADIUS * 0.8,
      0, -RADIUS * 1.1
    )
    ctx.bezierCurveTo(
      -RADIUS * 0.6, -RADIUS * 0.8,
      -RADIUS * 0.4, -RADIUS * 0.3,
      0, 0
    )
    ctx.fillStyle = i % 2 === 0 ? '#fb923c' : '#fbbf24'
    ctx.globalAlpha = 0.7
    ctx.fill()
    ctx.restore()
  }

  // Center ball
  ctx.beginPath()
  ctx.arc(x, y, RADIUS, 0, Math.PI * 2)
  const grad = ctx.createRadialGradient(x, y, 0, x, y, RADIUS)
  grad.addColorStop(0, '#fff7ed')
  grad.addColorStop(0.4, '#f97316')
  grad.addColorStop(1, '#ea580c')
  ctx.fillStyle = grad
  ctx.globalAlpha = 1
  ctx.fill()
  ctx.restore()

  ctx.restore()
}

// ─── FIREBALL IMPACT ──────────────────────────────────────────────────────────

export function drawFireballImpact(
  ctx: CanvasRenderingContext2D,
  impact: Impact,
  canvasWidth: number,
  canvasHeight: number,
  now: number
): void {
  ctx.save()

  const elapsed = now - impact.startTime
  const t = clamp(elapsed / 400, 0, 1)
  if (t >= 1) { ctx.restore(); return }

  const x = canvasWidth * 0.5
  const y = canvasHeight * 0.4
  const opacity = 1 - t
  const burstRadius = lerp(0, 80, easeOutCubic(t))
  ctx.save()
  ctx.shadowColor = '#f97316'
  ctx.shadowBlur = 30

  // Burst ring
  ctx.beginPath()
  ctx.arc(x, y, burstRadius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(249,115,22,${opacity})`
  ctx.lineWidth = 4
  ctx.stroke()

  // 16 spark particles with gravity
  const sparkCount = 16
  for (let i = 0; i < sparkCount; i++) {
    const angle = (i / sparkCount) * Math.PI * 2
    const speed = lerp(40, 120, (i % 3) / 2)
    const gravity = 80
    const px = x + Math.cos(angle) * speed * t
    const py = y + Math.sin(angle) * speed * t + 0.5 * gravity * t * t
    const sparkRadius = lerp(4, 1, t)
    ctx.beginPath()
    ctx.arc(px, py, sparkRadius, 0, Math.PI * 2)
    ctx.fillStyle = i % 2 === 0
      ? `rgba(251,191,36,${opacity})`
      : `rgba(249,115,22,${opacity})`
    ctx.globalAlpha = opacity
    ctx.fill()
  }

  ctx.restore()
  ctx.restore()
}

// ─── ZAP SHOT ────────────────────────────────────────────────────────────────

export function drawZapShot(
  ctx: CanvasRenderingContext2D,
  projectile: Projectile,
  canvasWidth: number,
  canvasHeight: number,
  now: number
): void {
  ctx.save()

  const elapsed = now - projectile.startTime
  const t = clamp(elapsed / projectile.duration, 0, 1)

  const fromX = projectile.fromSide === 'local' ? 0 : canvasWidth
  const toX = projectile.fromSide === 'local' ? canvasWidth : 0
  const currentX = lerp(fromX, toX, easeOutQuad(t))
  const y = canvasHeight * 0.5

  const segmentLength = 60
  const amplitude = 10

  ctx.shadowColor = '#facc15'
  ctx.shadowBlur = 12
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 2
  ctx.globalAlpha = 1 - t * 0.3

  const direction = projectile.fromSide === 'local' ? 1 : -1
  ctx.beginPath()
  ctx.moveTo(currentX, y)
  const segments = 6
  for (let i = 0; i < segments; i++) {
    const segX = currentX + direction * (i + 1) * (segmentLength / segments)
    const segY = y + (i % 2 === 0 ? amplitude : -amplitude)
    ctx.lineTo(segX, segY)
  }
  ctx.stroke()

  // Electric core
  ctx.beginPath()
  ctx.arc(currentX, y, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#fef08a'
  ctx.globalAlpha = 0.9
  ctx.fill()

  ctx.restore()
}

// ─── ZAP IMPACT ──────────────────────────────────────────────────────────────

export function drawZapImpact(
  ctx: CanvasRenderingContext2D,
  impact: Impact,
  canvasWidth: number,
  canvasHeight: number,
  now: number
): void {
  ctx.save()

  const elapsed = now - impact.startTime
  const t = clamp(elapsed / 200, 0, 1)
  if (t >= 1) { ctx.restore(); return }

  const x = canvasWidth * 0.5
  const y = canvasHeight * 0.4
  const opacity = 1 - t

  ctx.shadowColor = '#facc15'
  ctx.shadowBlur = 20

  // 3 radiating zigzag paths
  for (let r = 0; r < 3; r++) {
    const angle = (r / 3) * Math.PI * 2
    const length = lerp(0, 80, easeOutCubic(t))
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    const segs = 4
    for (let s = 0; s < segs; s++) {
      const sx = ((s + 1) / segs) * length
      const sy = s % 2 === 0 ? 8 : -8
      ctx.lineTo(sx, sy)
    }
    ctx.strokeStyle = `rgba(250,204,21,${opacity})`
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  ctx.restore()
}

// ─── SHIELD DOME ──────────────────────────────────────────────────────────────

export function drawShieldDome(
  ctx: CanvasRenderingContext2D,
  faceRegion: DOMRect,
  isBlocking: boolean,
  isHit: boolean,
  now: number
): void {
  ctx.save()

  const cx = faceRegion.x + faceRegion.width / 2
  const cy = faceRegion.y + faceRegion.height / 2
  const rx = faceRegion.width * 0.8
  const ry = faceRegion.height * 0.8

  const shimmerOffset = (now % 2000) / 2000

  // Hexagonal outline via 6 points
  ctx.beginPath()
  const sides = 6
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 6
    const px = cx + rx * Math.cos(angle)
    const py = cy + ry * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()

  // 5% fill
  ctx.fillStyle = isHit
    ? 'rgba(6,182,212,0.18)'
    : 'rgba(6,182,212,0.05)'
  ctx.fill()

  ctx.strokeStyle = isHit
    ? 'rgba(6,182,212,1)'
    : 'rgba(6,182,212,0.7)'
  ctx.lineWidth = isBlocking ? 2.5 : 1.5
  ctx.shadowColor = '#06b6d4'
  ctx.shadowBlur = isBlocking ? 16 : 8
  ctx.stroke()

  // Shimmer sweep
  const shimmerX = cx - rx + shimmerOffset * rx * 2
  const shimmerGrad = ctx.createLinearGradient(shimmerX - 20, cy, shimmerX + 20, cy)
  shimmerGrad.addColorStop(0, 'rgba(6,182,212,0)')
  shimmerGrad.addColorStop(0.5, 'rgba(6,182,212,0.4)')
  shimmerGrad.addColorStop(1, 'rgba(6,182,212,0)')
  ctx.fillStyle = shimmerGrad
  ctx.fill()

  // Crack animation on hit
  if (isHit) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1.5
    const crackAngles = [0.3, 1.2, 2.5, 4.1]
    for (const a of crackAngles) {
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * rx * 0.5, Math.sin(a) * ry * 0.5)
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.restore()
}

// ─── HEAL PARTICLES ───────────────────────────────────────────────────────────

export function drawHealParticles(
  ctx: CanvasRenderingContext2D,
  palmRegion: DOMRect,
  particles: CanvasParticle[],
  now: number
): void {
  ctx.save()

  for (const p of particles) {
    if (p.age >= p.lifetime) continue
    const t = p.age / p.lifetime
    const opacity = p.opacity * (1 - t)
    ctx.beginPath()
    ctx.arc(p.x, p.y - ATTACK_FLOAT_TEXT_RISE_PX * t, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(34,197,94,${opacity})`
    ctx.fill()
  }

  // Base glow at palm
  const px = palmRegion.x + palmRegion.width / 2
  const py = palmRegion.y + palmRegion.height / 2
  ctx.beginPath()
  ctx.arc(px, py, 16, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(34,197,94,0.15)'
  ctx.shadowColor = '#22c55e'
  ctx.shadowBlur = 20
  ctx.fill()

  ctx.restore()
}

// ─── ICE FREEZE OVERLAY ───────────────────────────────────────────────────────

export function drawIceFreezeOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  isActive: boolean,
  now: number
): void {
  if (!isActive) return
  ctx.save()

  // Frost glass tint
  ctx.fillStyle = 'rgba(186,230,253,0.12)'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Hue-rotate simulation via blue overlay
  ctx.fillStyle = 'rgba(14,165,233,0.08)'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Corner snowflakes
  const corners = [
    { x: 0, y: 0 },
    { x: canvasWidth, y: 0 },
    { x: 0, y: canvasHeight },
    { x: canvasWidth, y: canvasHeight },
  ]

  for (const corner of corners) {
    ctx.save()
    ctx.translate(corner.x, corner.y)
    drawSnowflake(ctx, 0, 0, 30, now)
    ctx.restore()
  }

  // Frost border
  ctx.strokeStyle = 'rgba(186,230,253,0.4)'
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, canvasWidth - 4, canvasHeight - 4)

  ctx.restore()
}

function drawSnowflake(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  now: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((now * 0.001) % (Math.PI * 2))
  ctx.strokeStyle = 'rgba(186,230,253,0.7)'
  ctx.lineWidth = 1.5

  for (let i = 0; i < 6; i++) {
    ctx.save()
    ctx.rotate((i / 6) * Math.PI * 2)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, size)
    // Small branches
    ctx.moveTo(0, size * 0.4)
    ctx.lineTo(size * 0.2, size * 0.6)
    ctx.moveTo(0, size * 0.4)
    ctx.lineTo(-size * 0.2, size * 0.6)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

// ─── THUNDER BOLT ─────────────────────────────────────────────────────────────

export function drawThunderBolt(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  now: number
): void {
  ctx.save()

  ctx.shadowColor = '#facc15'
  ctx.shadowBlur = 20
  ctx.strokeStyle = '#fef08a'
  ctx.lineWidth = 3

  const startX = canvasWidth / 2
  drawBranch(ctx, startX, 0, Math.PI / 2, canvasHeight, 0, now)

  // Inner bright core
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.shadowBlur = 6
  drawBranch(ctx, startX, 0, Math.PI / 2, canvasHeight, 0, now)

  ctx.restore()
}

function drawBranch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  depth: number,
  seed: number
): void {
  if (depth > 3 || length < 10) return

  const pseudoRand = (Math.sin(seed * 9.301 + depth * 4.67 + x * 0.01) + 1) / 2
  const angleOffset = (pseudoRand - 0.5) * 0.8
  const actualAngle = angle + angleOffset

  const endX = x + Math.cos(actualAngle) * length
  const endY = y + Math.sin(actualAngle) * length

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(endX, endY)
  ctx.stroke()

  // Branch off
  if (depth < 3) {
    const branchProb = (Math.sin(seed * 3.7 + depth + y * 0.05) + 1) / 2
    if (branchProb > 0.5) {
      drawBranch(
        ctx,
        x + (endX - x) * 0.6,
        y + (endY - y) * 0.6,
        actualAngle + Math.PI / 4,
        length * 0.4,
        depth + 1,
        seed + 1
      )
    }
    drawBranch(ctx, endX, endY, actualAngle, length * 0.6, depth + 1, seed + 2)
  }
}

// ─── FORCE SHOCKWAVE ─────────────────────────────────────────────────────────

export function drawForceShockwave(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  now: number,
  startTime: number
): void {
  ctx.save()

  const elapsed = now - startTime
  const t = clamp(elapsed / 500, 0, 1)
  if (t >= 1) { ctx.restore(); return }

  const cx = canvasWidth / 2
  const cy = canvasHeight / 2
  const radius = lerp(20, 200, easeOutCubic(t))
  const opacity = 1 - t

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(255,255,255,${opacity})`
  ctx.lineWidth = 3
  ctx.shadowColor = '#ffffff'
  ctx.shadowBlur = 12
  ctx.stroke()

  // Secondary ring
  if (t > 0.2) {
    const r2 = lerp(20, 200, easeOutCubic(clamp((t - 0.2) / 0.8, 0, 1)))
    ctx.beginPath()
    ctx.arc(cx, cy, r2, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(147,197,253,${opacity * 0.5})`
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.restore()
}

// ─── DRAGON BLAST ─────────────────────────────────────────────────────────────

export function drawDragonBlast(
  ctx: CanvasRenderingContext2D,
  projectile: Projectile,
  canvasWidth: number,
  canvasHeight: number,
  now: number
): void {
  ctx.save()

  const elapsed = now - projectile.startTime
  const t = clamp(elapsed / projectile.duration, 0, 1)
  const x = lerp(
    projectile.fromSide === 'local' ? 0 : canvasWidth,
    projectile.fromSide === 'local' ? canvasWidth : 0,
    easeOutQuad(t)
  )
  const y = canvasHeight * 0.5
  const direction = projectile.fromSide === 'local' ? 1 : -1

  ctx.shadowColor = '#f97316'
  ctx.shadowBlur = 30

  // Large fireball core (80px)
  const grad = ctx.createRadialGradient(x, y, 0, x, y, 40)
  grad.addColorStop(0, '#fff7ed')
  grad.addColorStop(0.3, '#fbbf24')
  grad.addColorStop(0.7, '#f97316')
  grad.addColorStop(1, '#dc2626')
  ctx.beginPath()
  ctx.arc(x, y, 40, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  // Dragon head via Path2D (60px, simplified)
  const headX = x + direction * 50
  const headY = y
  ctx.save()
  ctx.translate(headX, headY)
  if (direction < 0) ctx.scale(-1, 1)

  const dragon = new Path2D()
  // Snout
  dragon.moveTo(0, -10)
  dragon.bezierCurveTo(20, -15, 35, -10, 40, 0)
  // Lower jaw
  dragon.bezierCurveTo(35, 10, 20, 14, 0, 10)
  // Head back
  dragon.bezierCurveTo(-10, 5, -10, -5, 0, -10)
  // Horns
  dragon.moveTo(-5, -10)
  dragon.lineTo(-15, -25)
  dragon.moveTo(5, -10)
  dragon.lineTo(0, -28)

  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 2
  ctx.fillStyle = 'rgba(239,68,68,0.6)'
  ctx.fill(dragon)
  ctx.stroke(dragon)

  // Eye
  ctx.beginPath()
  ctx.arc(18, -4, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#fbbf24'
  ctx.fill()

  ctx.restore()
  ctx.restore()
}

// ─── DRAGON IMPACT ────────────────────────────────────────────────────────────

export function drawDragonImpact(
  ctx: CanvasRenderingContext2D,
  impact: Impact,
  canvasWidth: number,
  canvasHeight: number,
  now: number
): void {
  ctx.save()

  const elapsed = now - impact.startTime
  const t = clamp(elapsed / 600, 0, 1)
  if (t >= 1) { ctx.restore(); return }

  const x = canvasWidth * 0.5
  const y = canvasHeight * 0.4
  const opacity = 1 - t

  // Expanding burst
  const radius = lerp(0, 200, easeOutCubic(t))
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(249,115,22,${opacity * 0.8})`
  ctx.lineWidth = 4
  ctx.shadowColor = '#f97316'
  ctx.shadowBlur = 30
  ctx.stroke()

  // Orange burn overlay — clipped to impact area only
  const overlayRadius = lerp(0, 120, easeOutCubic(t))
  ctx.beginPath()
  ctx.arc(x, y, overlayRadius, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(249,115,22,${0.18 * opacity})`
  ctx.fill()

  // 40 gravity particles
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2
    const speed = 80 + (i % 5) * 20
    const gravity = 120
    const px = x + Math.cos(angle) * speed * t
    const py = y + Math.sin(angle) * speed * t + 0.5 * gravity * t * t
    const pr = clamp(lerp(5, 1, t), 1, 5)
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fillStyle = i % 3 === 0
      ? `rgba(251,191,36,${opacity})`
      : i % 3 === 1
        ? `rgba(249,115,22,${opacity})`
        : `rgba(239,68,68,${opacity})`
    ctx.fill()
  }

  ctx.restore()
}

// ─── REFLECT DOME ─────────────────────────────────────────────────────────────

export function drawReflectDome(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  now: number
): void {
  ctx.save()

  const cx = canvasWidth / 2
  const cy = canvasHeight * 0.55
  const rx = 120
  const ry = 60

  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0)
  ctx.closePath()

  ctx.fillStyle = 'rgba(168,85,247,0.3)'
  ctx.fill()

  ctx.strokeStyle = '#a855f7'
  ctx.lineWidth = 2
  ctx.shadowColor = '#a855f7'
  ctx.shadowBlur = 14

  // Animated shimmer
  const shimmer = (Math.sin(now * 0.004) + 1) / 2
  ctx.globalAlpha = 0.7 + shimmer * 0.3
  ctx.stroke()

  ctx.restore()
}

// ─── FLOATING TEXT ────────────────────────────────────────────────────────────

export function drawFloatingText(
  ctx: CanvasRenderingContext2D,
  text: FloatingText,
  now: number
): void {
  ctx.save()

  const elapsed = now - text.startTime
  const t = clamp(elapsed / ATTACK_FLOAT_TEXT_DURATION, 0, 1)
  if (t >= 1) { ctx.restore(); return }

  const rise = easeOutCubic(t) * ATTACK_FLOAT_TEXT_RISE_PX
  const opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3

  ctx.font = 'bold 18px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = text.text.startsWith('+')
    ? `rgba(34,197,94,${opacity})`
    : text.text.startsWith('-')
      ? `rgba(239,68,68,${opacity})`
      : `rgba(255,255,255,${opacity})`
  ctx.shadowColor = ctx.fillStyle
  ctx.shadowBlur = 8
  ctx.globalAlpha = opacity
  ctx.fillText(text.text, text.x, text.y - rise)

  ctx.restore()
}

// ─── DODGE LINES ──────────────────────────────────────────────────────────────

export function drawDodgeLines(
  ctx: CanvasRenderingContext2D,
  side: PlayerSide,
  direction: 'left' | 'right',
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.save()

  const xBase = side === 'local' ? canvasWidth * 0.25 : canvasWidth * 0.75
  const lineLength = 60
  const dx = direction === 'left' ? -lineLength : lineLength

  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 2

  const offsets = [-20, 0, 20]
  for (const offset of offsets) {
    ctx.beginPath()
    ctx.moveTo(xBase, canvasHeight * 0.5 + offset)
    ctx.lineTo(xBase + dx, canvasHeight * 0.5 + offset)
    ctx.stroke()
  }

  ctx.restore()
}

// ─── SCREEN SHAKE ─────────────────────────────────────────────────────────────

export function drawScreenShake(
  ctx: CanvasRenderingContext2D,
  amplitude: number
): void {
  if (amplitude <= 0) return
  ctx.save()
  const dx = (Math.random() - 0.5) * 2 * amplitude
  const dy = (Math.random() - 0.5) * 2 * amplitude
  ctx.translate(dx, dy)
  // NOTE: caller must manage save/restore pairing around this
  ctx.restore()
}

// ─── GESTURE HAND ACTIVATION OVERLAY ────────────────────────────────────────

export function drawGestureActivationOnHand(
  ctx: CanvasRenderingContext2D,
  palmX: number,
  palmY: number,
  powerId: string | null,
  gestureId: string,
  startTime: number,
  now: number
): void {
  ctx.save()

  const elapsed = now - startTime
  const duration = 700
  const t = Math.min(elapsed / duration, 1)
  if (t >= 1) { ctx.restore(); return }

  const fadeOut = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1
  const scaleIn = t < 0.2 ? Math.max(t / 0.2, 0.1) : 1

  ctx.translate(palmX, palmY)
  ctx.scale(scaleIn, scaleIn)
  ctx.globalAlpha = fadeOut * scaleIn

  // Color and label per power/gesture
  let color = '#3b82f6'
  let label = ''
  let symbol = ''

  switch (powerId) {
    case 'fire_punch':
      color = '#f97316'
      label = 'FIRE PUNCH'
      symbol = '🔥'
      break
    case 'shield':
      color = '#06b6d4'
      label = 'SHIELD'
      symbol = '🛡'
      break
    case 'zap_shot':
      color = '#facc15'
      label = 'ZAP SHOT'
      symbol = '⚡'
      break
    case 'heal':
      color = '#22c55e'
      label = 'HEAL'
      symbol = '💚'
      break
    case 'ice_freeze':
      color = '#bae6fd'
      label = 'ICE FREEZE'
      symbol = '❄'
      break
    case 'double_strike':
      color = '#3b82f6'
      label = 'DOUBLE STRIKE'
      symbol = '✕✕'
      break
    case 'thunder_smash':
      color = '#facc15'
      label = 'THUNDER SMASH'
      symbol = '⚡⚡'
      break
    case 'force_push':
      color = '#a855f7'
      label = 'FORCE PUSH'
      symbol = '◎'
      break
    case 'dragon_blast':
      color = '#dc2626'
      label = 'DRAGON BLAST'
      symbol = '🐉'
      break
    case 'reflect_dome':
      color = '#a855f7'
      label = 'REFLECT'
      symbol = '◈'
      break
    case 'full_restore':
      color = '#22c55e'
      label = 'FULL RESTORE'
      symbol = '✦'
      break
    default:
      switch (gestureId) {
        case 'fist': color = '#f97316'; label = 'FIST'; symbol = '✊'; break
        case 'open_palm': color = '#06b6d4'; label = 'PALM'; symbol = '✋'; break
        case 'index_point': color = '#facc15'; label = 'POINT'; symbol = '☝'; break
        case 'shaka': color = '#22c55e'; label = 'HEAL'; symbol = '🤙'; break
        default: color = '#ffffff'; label = gestureId.toUpperCase(); symbol = '◉'
      }
  }

  // Outer pulsing ring
  const ringRadius = 44 + Math.sin(now * 0.015) * 4
  ctx.beginPath()
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.globalAlpha = fadeOut * 0.8 * scaleIn
  ctx.shadowColor = color
  ctx.shadowBlur = Math.min(18 * scaleIn, 18)
  ctx.stroke()

  // Inner filled circle
  ctx.beginPath()
  ctx.arc(0, 0, 28, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = fadeOut * 0.18 * scaleIn
  ctx.fill()

  // Rotating arc segments
  const arcCount = 4
  for (let i = 0; i < arcCount; i++) {
    const startAngle = (i / arcCount) * Math.PI * 2 + (now * 0.004)
    const endAngle = startAngle + Math.PI / (arcCount * 1.5)
    ctx.beginPath()
    ctx.arc(0, 0, ringRadius + 8, startAngle, endAngle)
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.globalAlpha = fadeOut * 0.6 * scaleIn
    ctx.shadowBlur = Math.min(12 * scaleIn, 12)
    ctx.stroke()
  }

  // Symbol text
  ctx.globalAlpha = fadeOut * scaleIn
  ctx.shadowBlur = Math.min(10 * scaleIn, 10)
  ctx.shadowColor = color
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(symbol, 0, 0)

  // Label pill above palm
  const pillY = -ringRadius - 22
  const pillW = label.length * 7 + 16
  const pillH = 20
  ctx.globalAlpha = fadeOut * 0.92 * scaleIn
  ctx.shadowBlur = Math.min(14 * scaleIn, 14)
  ctx.shadowColor = color

  // Pill background
  ctx.beginPath()
  ctx.roundRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, 10)
  ctx.fillStyle = '#0d1117'
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Pill text
  ctx.font = 'bold 10px "Inter", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.shadowBlur = 6
  ctx.fillText(label, 0, pillY)

  ctx.restore()
}

// ─── CRACK OVERLAY ────────────────────────────────────────────────────────────

export function drawCrackOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  intensity: number
): void {
  if (intensity <= 0) return
  ctx.save()

  const opacity = lerp(0.3, 0.6, intensity)
  ctx.strokeStyle = `rgba(255,255,255,${opacity})`
  ctx.lineWidth = 1.5

  // Pre-computed jagged crack paths (deterministic, not random — stable per render)
  const cracks: Array<Array<[number, number]>> = [
    [[0.5, 0], [0.48, 0.15], [0.52, 0.25], [0.45, 0.4], [0.5, 0.55]],
    [[0.3, 0], [0.35, 0.12], [0.28, 0.22], [0.32, 0.35]],
    [[0.7, 0], [0.68, 0.1], [0.72, 0.2], [0.65, 0.32]],
    [[0.5, 0.55], [0.42, 0.65], [0.38, 0.8], [0.44, 0.95]],
    [[0.5, 0.55], [0.58, 0.68], [0.62, 0.82], [0.55, 1.0]],
  ]

  for (const crack of cracks) {
    ctx.beginPath()
    crack.forEach(([fx, fy], i) => {
      const px = fx * canvasWidth
      const py = fy * canvasHeight
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }

  ctx.restore()
}