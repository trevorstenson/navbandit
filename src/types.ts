export interface BanditConfig {
  /** Exploration parameter — higher = more exploration. Default: 1.0 */
  alpha: number
  /** DUCB discount factor — lower = faster adaptation. Default: 0.95 */
  discount: number
  /** Context vector dimensionality. Default: 8 */
  dimensions: number
  /** Number of top predictions to return. Default: 3 */
  topK: number
  /** Drop arms not seen in this many navigations. Default: 50 */
  pruneAfter: number
}

export interface ArmState {
  /** Inverse of the design matrix (d×d), flattened row-major */
  aInv: number[]
  /** Reward-weighted context sum (d×1) */
  b: number[]
  /** Total pulls for this arm */
  pulls: number
  /** Navigation count when last seen */
  lastSeen: number
}

export interface BanditState {
  arms: Record<string, ArmState>
  totalPulls: number
  sessionId: string
}

export interface Prediction {
  url: string
  score: number
  confidence: number
  eagerness: 'eager' | 'moderate' | 'conservative'
}

// SW ↔ main thread message protocol (prefixed to avoid collisions in shared SWs)
export type SWMessage =
  | { type: 'navbandit:predictions'; predictions: Prediction[] }

export type ClientMessage =
  | { type: 'navbandit:discover-links'; urls: string[] }
  | { type: 'navbandit:reward'; url: string; value: number }
  | { type: 'navbandit:scroll-depth'; depth: number }
