export class RNG {
  private state: number

  constructor(seed: number) {
    this.state = seed | 0
  }

  random(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  randomInt(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1))
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.random() * arr.length)]
  }

  shuffle<T>(arr: T[]): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  weightedSample(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.random() * total
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]
      if (r <= 0) return i
    }
    return weights.length - 1
  }
}
