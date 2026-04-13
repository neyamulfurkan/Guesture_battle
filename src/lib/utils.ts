export function generateRoomCode(): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const digits = '0123456789'
  const a1 = alpha[Math.floor(Math.random() * alpha.length)]
  const a2 = alpha[Math.floor(Math.random() * alpha.length)]
  const n1 = digits[Math.floor(Math.random() * digits.length)]
  const n2 = digits[Math.floor(Math.random() * digits.length)]
  const n3 = digits[Math.floor(Math.random() * digits.length)]
  const n4 = digits[Math.floor(Math.random() * digits.length)]
  return `${a1}${a2}${n1}${n2}${n3}${n4}`
}

export function computeThreadId(userIdA: string, userIdB: string): string {
  const [first, second] = [userIdA, userIdB].sort()
  return `${first}:${second}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function easeOutQuad(t: number): number {
  return t * (2 - t)
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function formatCooldown(ms: number): string {
  const seconds = ms / 1000
  return `${seconds % 1 === 0 ? seconds.toFixed(0) : seconds.toFixed(1)}s`
}

export function normalizeVoiceKeyword(raw: string): string {
  return raw.trim().toUpperCase()
}

export function calculateLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function distancePx(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

export function boundingBoxArea(
  landmarks: Array<{ x: number; y: number }>,
  width: number,
  height: number
): number {
  if (landmarks.length === 0) return 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const lm of landmarks) {
    const px = lm.x * width
    const py = lm.y * height
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }
  return (maxX - minX) * (maxY - minY)
}