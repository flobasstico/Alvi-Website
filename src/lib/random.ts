// Kryptografisch sauberer Zufall – fair genug für Live-Würfe vor Publikum.

export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error("maxExclusive muss > 0 sein")
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive
  const buf = new Uint32Array(1)
  let n: number
  do {
    crypto.getRandomValues(buf)
    n = buf[0]
  } while (n >= limit) // Rejection Sampling gegen Modulo-Bias
  return n % maxExclusive
}

export function pick<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error("Leere Liste")
  return items[randomInt(items.length)]
}

export function weightedIndex(weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) throw new Error("Summe der Gewichte muss > 0 sein")
  let r = randomInt(total)
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i
  }
  return weights.length - 1
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function sample<T>(items: readonly T[], n: number): T[] {
  return shuffle(items).slice(0, n)
}
