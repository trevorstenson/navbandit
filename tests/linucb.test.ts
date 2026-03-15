import { describe, it, expect } from 'vitest'
import { createArm, score, update, selectTopK } from '../src/linucb'

const D = 4

function randomContext(): number[] {
  return Array.from({ length: D }, () => Math.random())
}

describe('LinUCB', () => {
  it('cold start: uniform exploration when all arms have zero pulls', () => {
    const arms: Record<string, ReturnType<typeof createArm>> = {}
    for (let i = 0; i < 5; i++) arms[`/page${i}`] = createArm(D)

    const ctx = [0.5, 0.5, 0.5, 0.5]
    const scores = Object.values(arms).map((a) => score(a, ctx, 1.0))

    // All arms should have the same UCB score (all identical state)
    const first = scores[0].ucb
    for (const s of scores) {
      expect(s.ucb).toBeCloseTo(first, 10)
      expect(s.mean).toBe(0) // no learned signal yet
      expect(s.exploration).toBeGreaterThan(0)
    }
  })

  it('fixed-optimal arm converges to top selection', () => {
    const arms: Record<string, ReturnType<typeof createArm>> = {
      '/good': createArm(D),
      '/bad1': createArm(D),
      '/bad2': createArm(D),
    }

    const goodCtx = [1, 0.5, 0.3, 0.8]

    // Train: /good always gets reward=1, others get reward=0
    for (let i = 0; i < 100; i++) {
      const ctx = randomContext()
      update(arms['/good'], ctx, 1.0, 1.0) // no discounting
      update(arms['/bad1'], ctx, 0.0, 1.0)
      update(arms['/bad2'], ctx, 0.0, 1.0)
    }

    const predictions = selectTopK(arms, goodCtx, 1, 1.0)
    expect(predictions[0].url).toBe('/good')
    expect(predictions[0].score).toBeGreaterThan(0)
  })

  it('DUCB adapts when optimal arm switches', () => {
    const arms: Record<string, ReturnType<typeof createArm>> = {
      '/armA': createArm(D),
      '/armB': createArm(D),
    }

    const ctx = [0.5, 0.5, 0.5, 0.5]
    const discount = 0.95

    // Phase 1: armA is good
    for (let i = 0; i < 200; i++) {
      const c = randomContext()
      update(arms['/armA'], c, 1.0, discount)
      update(arms['/armB'], c, 0.0, discount)
    }

    let top = selectTopK(arms, ctx, 1, 1.0)
    expect(top[0].url).toBe('/armA')

    // Phase 2: armB becomes good, armA becomes bad
    for (let i = 0; i < 200; i++) {
      const c = randomContext()
      update(arms['/armA'], c, 0.0, discount)
      update(arms['/armB'], c, 1.0, discount)
    }

    top = selectTopK(arms, ctx, 1, 1.0)
    expect(top[0].url).toBe('/armB')
  })

  it('Sherman-Morrison matches brute-force inversion for small d', () => {
    const arm = createArm(D)
    const contexts: number[][] = []
    const rewards: number[] = []

    // Run 100 updates via Sherman-Morrison
    for (let i = 0; i < 100; i++) {
      const ctx = randomContext()
      const reward = Math.random()
      contexts.push(ctx)
      rewards.push(reward)
      update(arm, ctx, reward, 1.0) // no discounting for clean comparison
    }

    // Brute-force: build A = I + Σ x·xᵀ, then invert
    const A = Array.from({ length: D * D }, (_, idx) =>
      Math.floor(idx / D) === idx % D ? 1 : 0
    )
    for (const ctx of contexts) {
      for (let i = 0; i < D; i++) {
        for (let j = 0; j < D; j++) {
          A[i * D + j] += ctx[i] * ctx[j]
        }
      }
    }

    // Invert A using Gauss-Jordan (d=4, fine for test)
    const augmented = A.slice()
    const inv = Array.from({ length: D * D }, (_, idx) =>
      Math.floor(idx / D) === idx % D ? 1 : 0
    )

    // Simple Gauss-Jordan for 4x4
    const m = Array.from({ length: D }, (_, i) =>
      Array.from({ length: 2 * D }, (_, j) =>
        j < D ? A[i * D + j] : (j - D === i ? 1 : 0)
      )
    )

    for (let col = 0; col < D; col++) {
      // Pivot
      let maxRow = col
      for (let row = col + 1; row < D; row++) {
        if (Math.abs(m[row][col]) > Math.abs(m[maxRow][col])) maxRow = row
      }
      ;[m[col], m[maxRow]] = [m[maxRow], m[col]]

      const pivot = m[col][col]
      for (let j = 0; j < 2 * D; j++) m[col][j] /= pivot

      for (let row = 0; row < D; row++) {
        if (row === col) continue
        const factor = m[row][col]
        for (let j = 0; j < 2 * D; j++) m[row][j] -= factor * m[col][j]
      }
    }

    // Compare Sherman-Morrison A_inv with brute-force inverse
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        const smVal = arm.aInv[i * D + j]
        const bfVal = m[i][j + D]
        expect(smVal).toBeCloseTo(bfVal, 4) // within 1e-4
      }
    }
  })

  it('selectTopK returns correct number of results', () => {
    const arms: Record<string, ReturnType<typeof createArm>> = {}
    for (let i = 0; i < 10; i++) arms[`/p${i}`] = createArm(D)

    const ctx = randomContext()
    const top3 = selectTopK(arms, ctx, 3, 1.0)
    expect(top3).toHaveLength(3)

    const top1 = selectTopK(arms, ctx, 1, 1.0)
    expect(top1).toHaveLength(1)
  })
})
