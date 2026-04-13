// src/services/particleSystem.ts
// Fixed-size particle pools for attack effects and ambient background animation.

import {
  MAX_FIRE_PARTICLES,
  MAX_LIGHTNING_PARTICLES,
  MAX_HEALING_PARTICLES,
  BACKGROUND_PARTICLE_COUNT_DESKTOP,
  BACKGROUND_PARTICLE_COUNT_MOBILE,
} from '@/lib/gameConstants'
import { clamp } from '@/lib/utils'

// ─── SHARED INTERFACE ─────────────────────────────────────────────────────────

export interface Particle {
  id: string
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

// ─── PARTICLE TYPE CONFIG ─────────────────────────────────────────────────────

type ParticleType = 'fire' | 'lightning' | 'healing' | 'spark'

interface ParticleTypeConfig {
  maxCount: number
  color: string
  minRadius: number
  maxRadius: number
  minLifetime: number
  maxLifetime: number
  minVx: number
  maxVx: number
  minVy: number
  maxVy: number
  gravity: number
}

const PARTICLE_CONFIGS: Record<ParticleType, ParticleTypeConfig> = {
  fire: {
    maxCount: MAX_FIRE_PARTICLES,
    color: '#f97316',
    minRadius: 2,
    maxRadius: 6,
    minLifetime: 400,
    maxLifetime: 800,
    minVx: -2,
    maxVx: 2,
    minVy: -4,
    maxVy: -1,
    gravity: 0.05,
  },
  lightning: {
    maxCount: MAX_LIGHTNING_PARTICLES,
    color: '#facc15',
    minRadius: 1,
    maxRadius: 3,
    minLifetime: 150,
    maxLifetime: 350,
    minVx: -4,
    maxVx: 4,
    minVy: -4,
    maxVy: 4,
    gravity: 0,
  },
  healing: {
    maxCount: MAX_HEALING_PARTICLES,
    color: '#22c55e',
    minRadius: 2,
    maxRadius: 5,
    minLifetime: 600,
    maxLifetime: 1000,
    minVx: -1,
    maxVx: 1,
    minVy: -2.5,
    maxVy: -0.5,
    gravity: -0.02,
  },
  spark: {
    maxCount: MAX_FIRE_PARTICLES,
    color: '#fbbf24',
    minRadius: 1,
    maxRadius: 3,
    minLifetime: 200,
    maxLifetime: 500,
    minVx: -5,
    maxVx: 5,
    minVy: -5,
    maxVy: 5,
    gravity: 0.15,
  },
}

// ─── PARTICLE SYSTEM ──────────────────────────────────────────────────────────

let _particleIdCounter = 0

function generateId(): string {
  return `p_${++_particleIdCounter}`
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export class ParticleSystem {
  private pools: Map<ParticleType, Particle[]> = new Map()

  constructor() {
    for (const type of Object.keys(PARTICLE_CONFIGS) as ParticleType[]) {
      this.pools.set(type, [])
    }
  }

  emit(type: ParticleType, x: number, y: number, count: number): void {
    const config = PARTICLE_CONFIGS[type]
    const pool = this.pools.get(type)!

    for (let i = 0; i < count; i++) {
      // Remove oldest particle if at capacity
      if (pool.length >= config.maxCount) {
        pool.shift()
      }

      const particle: Particle = {
        id: generateId(),
        x,
        y,
        vx: randBetween(config.minVx, config.maxVx),
        vy: randBetween(config.minVy, config.maxVy),
        radius: randBetween(config.minRadius, config.maxRadius),
        opacity: 1,
        color: config.color,
        lifetime: randBetween(config.minLifetime, config.maxLifetime),
        age: 0,
      }

      pool.push(particle)
    }
  }

  update(deltaTime: number): void {
    for (const [type, pool] of this.pools) {
      const config = PARTICLE_CONFIGS[type]
      let i = pool.length - 1

      while (i >= 0) {
        const p = pool[i]
        p.age += deltaTime

        if (p.age >= p.lifetime) {
          pool.splice(i, 1)
          i--
          continue
        }

        // Apply velocity
        p.x += p.vx
        p.y += p.vy

        // Apply gravity
        p.vy += config.gravity

        // Fade opacity based on age/lifetime ratio
        const lifeRatio = p.age / p.lifetime
        p.opacity = clamp(1 - lifeRatio, 0, 1)

        i--
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save()

    for (const pool of this.pools.values()) {
      for (const p of pool) {
        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    ctx.restore()
  }

  clear(): void {
    for (const pool of this.pools.values()) {
      pool.length = 0
    }
  }

  get totalCount(): number {
    let count = 0
    for (const pool of this.pools.values()) {
      count += pool.length
    }
    return count
  }
}

// ─── BACKGROUND PARTICLE ──────────────────────────────────────────────────────

interface BackgroundParticle {
  x: number
  y: number
  vy: number
  vxDrift: number
  radius: number
  opacity: number
}

export class BackgroundParticleSystem {
  private particles: BackgroundParticle[] = []
  private canvasWidth: number = 0
  private canvasHeight: number = 0
  private count: number = BACKGROUND_PARTICLE_COUNT_DESKTOP

  init(canvasWidth: number, canvasHeight: number, isMobile: boolean): void {
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.count = isMobile
      ? BACKGROUND_PARTICLE_COUNT_MOBILE
      : BACKGROUND_PARTICLE_COUNT_DESKTOP

    this.particles = []

    for (let i = 0; i < this.count; i++) {
      this.particles.push(this.createParticle(true))
    }
  }

  private createParticle(randomY: boolean): BackgroundParticle {
    return {
      x: Math.random() * this.canvasWidth,
      y: randomY
        ? Math.random() * this.canvasHeight
        : this.canvasHeight + Math.random() * 20,
      vy: -(0.2 + Math.random() * 0.3), // upward drift
      vxDrift: (Math.random() - 0.5) * 0.15,
      radius: 1 + Math.random(), // 1–2px
      opacity: 0.03,
    }
  }

  resize(canvasWidth: number, canvasHeight: number, isMobile: boolean): void {
    this.init(canvasWidth, canvasHeight, isMobile)
  }

  update(): void {
    for (const p of this.particles) {
      p.y += p.vy
      p.x += p.vxDrift

      // Wrap horizontal edges
      if (p.x < 0) p.x = this.canvasWidth
      if (p.x > this.canvasWidth) p.x = 0

      // Reset to bottom when particle reaches top
      if (p.y < -p.radius) {
        p.x = Math.random() * this.canvasWidth
        p.y = this.canvasHeight + p.radius
        p.vy = -(0.2 + Math.random() * 0.3)
        p.vxDrift = (Math.random() - 0.5) * 0.15
        p.radius = 1 + Math.random()
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = 0.03

    for (const p of this.particles) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}