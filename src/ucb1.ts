export interface Arm {
  pulls: number
  rewards: number
  lastSeen: number
}

export function createArm(lastSeen: number): Arm {
  return { pulls: 0, rewards: 0, lastSeen }
}

export function ucbScore(arm: Arm, totalPulls: number, alpha: number): number {
  if (arm.pulls === 0) return Infinity
  const exploitation = arm.rewards / arm.pulls
  const exploration = alpha * Math.sqrt(Math.log(totalPulls) / arm.pulls)
  return exploitation + exploration
}

export function selectTopK(
  arms: Record<string, Arm>,
  totalPulls: number,
  k: number,
  alpha: number
): string[] {
  return Object.entries(arms)
    .map(([url, arm]) => ({ url, score: ucbScore(arm, totalPulls, alpha) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((p) => p.url)
}
