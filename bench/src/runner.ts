import { RNG } from './rng.js'
import type {
  Site,
  TrafficMatrix,
  NavigationStep,
  Strategy,
  TrialResult,
  RunnerConfig,
} from './types.js'
import {
  NavBanditStrategy,
  PrefetchAllStrategy,
  StaticTopKStrategy,
  RandomKStrategy,
  NoPrefetchStrategy,
} from './strategies.js'

const SLIDING_WINDOW = 50
const BANDWIDTH_PER_PREFETCH_KB = 200

export function createStrategies(
  matrix: TrafficMatrix,
  k: number,
  alpha: number,
  rng: RNG
): Strategy[] {
  return [
    new NavBanditStrategy(k, alpha),
    new PrefetchAllStrategy(),
    new StaticTopKStrategy(matrix, k),
    new RandomKStrategy(k, rng),
    new NoPrefetchStrategy(),
  ]
}

export function runTrial(config: RunnerConfig, rng: RNG): TrialResult[] {
  const { site, trafficMatrix, navigations, k, alpha } = config
  const strategies = createStrategies(trafficMatrix, k, alpha, rng)

  // Per-strategy tracking
  const tracking = strategies.map(() => ({
    hits: 0,
    totalPrefetches: 0,
    hitWindow: [] as boolean[],
    hitRateOverTime: [] as number[],
  }))

  // Find oracle's sliding window hit rates for convergence calculation
  const oracleIdx = strategies.findIndex(s => s.id === 'static-top-k')
  const banditIdx = strategies.findIndex(s => s.id === 'navbandit')

  for (let step = 0; step < navigations.length; step++) {
    const nav = navigations[step]
    const page = site.pages[nav.currentPage]
    if (!page) continue

    const availableLinks = page.links

    for (let si = 0; si < strategies.length; si++) {
      const strategy = strategies[si]
      const track = tracking[si]

      // Get prefetch predictions
      const prefetched = strategy.onNavigate(nav.currentPage, availableLinks)
      track.totalPrefetches += prefetched.length

      // Check hit (skip at session boundaries)
      if (!nav.isSessionBoundary) {
        const isHit = prefetched.includes(nav.destination)
        if (isHit) track.hits++

        // Sliding window
        track.hitWindow.push(isHit)
        if (track.hitWindow.length > SLIDING_WINDOW) track.hitWindow.shift()
      }

      // Record sliding window hit rate
      const windowHits = track.hitWindow.filter(Boolean).length
      const windowRate = track.hitWindow.length > 0 ? windowHits / track.hitWindow.length : 0
      track.hitRateOverTime.push(windowRate)

      // Reveal actual destination
      strategy.onReveal(nav.destination)
    }
  }

  // Compute convergence for NavBandit
  let convergenceNav: number | null = null
  if (banditIdx >= 0 && oracleIdx >= 0) {
    const banditRates = tracking[banditIdx].hitRateOverTime
    const oracleRates = tracking[oracleIdx].hitRateOverTime
    const sustainedSteps = 10

    for (let i = SLIDING_WINDOW; i < banditRates.length - sustainedSteps; i++) {
      const oracleRate = oracleRates[i]
      if (oracleRate === 0) continue

      let sustained = true
      for (let j = 0; j < sustainedSteps; j++) {
        if (banditRates[i + j] < oracleRates[i + j] * 0.9) {
          sustained = false
          break
        }
      }
      if (sustained) {
        convergenceNav = i
        break
      }
    }
  }

  return strategies.map((strategy, si) => {
    const track = tracking[si]
    const nonBoundarySteps = navigations.filter(n => !n.isSessionBoundary).length
    const hitRate = nonBoundarySteps > 0 ? track.hits / nonBoundarySteps : 0
    const efficiency = track.totalPrefetches > 0 ? track.hits / track.totalPrefetches : 0

    return {
      strategy: strategy.id,
      hitRate,
      efficiency,
      totalPrefetches: track.totalPrefetches,
      hits: track.hits,
      wastedPrefetches: track.totalPrefetches - track.hits,
      bandwidthKB: track.totalPrefetches * BANDWIDTH_PER_PREFETCH_KB,
      convergenceNav: strategy.id === 'navbandit' ? convergenceNav : null,
      hitRateOverTime: track.hitRateOverTime,
    }
  })
}
