import type { ArmState, BanditConfig, Prediction } from './types'

/** Create a fresh arm with identity A_inv and zero b */
export function createArm(d: number): ArmState {
  const aInv = new Array(d * d).fill(0)
  for (let i = 0; i < d; i++) aInv[i * d + i] = 1 // identity
  return { aInv, b: new Array(d).fill(0), pulls: 0, lastSeen: 0 }
}

/** Score an arm: θ = A_inv·b, UCB = θᵀx + α·√(xᵀ A_inv x) */
export function score(
  arm: ArmState,
  context: number[],
  alpha: number
): { ucb: number; mean: number; exploration: number } {
  const d = context.length
  const theta = matVecMul(arm.aInv, d, arm.b)
  const mean = dot(theta, context)
  const aInvX = matVecMul(arm.aInv, d, context)
  const exploration = alpha * Math.sqrt(Math.max(0, dot(context, aInvX)))
  return { ucb: mean + exploration, mean, exploration }
}

/** Update arm with Sherman-Morrison + DUCB discounting */
export function update(
  arm: ArmState,
  context: number[],
  reward: number,
  discount: number
): void {
  const d = context.length

  // DUCB: discount before update — A_inv scales by 1/γ, b scales by γ
  if (discount < 1) {
    const invDiscount = 1 / discount
    for (let i = 0; i < arm.aInv.length; i++) arm.aInv[i] *= invDiscount
    for (let i = 0; i < d; i++) arm.b[i] *= discount
  }

  // Sherman-Morrison: A_inv -= (A_inv·x)(A_inv·x)ᵀ / (1 + xᵀ·A_inv·x)
  const ax = matVecMul(arm.aInv, d, context)
  const denom = 1 + dot(context, ax)
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      arm.aInv[i * d + j] -= (ax[i] * ax[j]) / denom
    }
  }

  // b += reward * x
  for (let i = 0; i < d; i++) arm.b[i] += reward * context[i]
  arm.pulls++
}

/** Select top K arms by UCB score */
export function selectTopK(
  arms: Record<string, ArmState>,
  context: number[],
  k: number,
  alpha: number
): Prediction[] {
  const scored: Prediction[] = []
  for (const url in arms) {
    const s = score(arms[url], context, alpha)
    const confidence = s.mean / (s.mean + s.exploration + 1e-9)
    scored.push({
      url,
      score: s.ucb,
      confidence: Math.max(0, Math.min(1, confidence)),
      eagerness: confidence > 0.7 ? 'eager' : confidence > 0.3 ? 'moderate' : 'conservative',
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

// --- inline linear algebra helpers (d < 20, no library needed) ---

function matVecMul(mat: number[], d: number, vec: number[]): number[] {
  const out = new Array(d)
  for (let i = 0; i < d; i++) {
    let sum = 0
    for (let j = 0; j < d; j++) sum += mat[i * d + j] * vec[j]
    out[i] = sum
  }
  return out
}

function dot(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}
