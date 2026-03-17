import { RNG } from './rng.js'
import { generateTopology } from './topology.js'
import { generateTrafficMatrix, generateTrialSequence } from './traffic.js'
import { runTrial } from './runner.js'
import type {
  BenchConfig,
  BenchmarkResult,
  StrategyId,
  TrialResult,
  StrategyStats,
} from './types.js'

const ALL_STRATEGIES: StrategyId[] = [
  'navbandit',
  'prefetch-all',
  'static-top-k',
  'random-k',
  'no-prefetch',
]

const METRICS = [
  'hitRate',
  'efficiency',
  'totalPrefetches',
  'hits',
  'wastedPrefetches',
  'bandwidthKB',
  'convergenceNav',
] as const

export function runBenchmark(config: BenchConfig): BenchmarkResult {
  const baseRng = new RNG(config.seed)

  // Generate topology and traffic matrix once (shared across trials)
  const site = generateTopology(config.topology, baseRng)
  const trafficMatrix = generateTrafficMatrix(site, config.traffic, baseRng)

  // Collect all trial results
  const allResults: Record<StrategyId, TrialResult[]> = {} as any
  for (const sid of ALL_STRATEGIES) {
    allResults[sid] = []
  }

  for (let trial = 0; trial < config.trials; trial++) {
    const trialRng = new RNG(config.seed + trial + 1)
    const navigations = generateTrialSequence(
      site,
      trafficMatrix,
      config.traffic,
      config.navigationsPerTrial,
      trialRng
    )

    const runnerRng = new RNG(config.seed + trial + 10000)
    const results = runTrial(
      {
        site,
        trafficMatrix,
        navigations,
        k: config.k,
        alpha: config.alpha,
      },
      runnerRng
    )

    for (const result of results) {
      allResults[result.strategy].push(result)
    }
  }

  // Compute stats with 95% CI
  const strategies: Record<StrategyId, StrategyStats> = {} as any
  for (const sid of ALL_STRATEGIES) {
    strategies[sid] = computeStats(allResults[sid])
  }

  return {
    topology: config.topology,
    traffic: config.traffic,
    trials: config.trials,
    navigationsPerTrial: config.navigationsPerTrial,
    strategies,
    metadata: {
      timestamp: new Date().toISOString(),
      seed: config.seed,
    },
  }
}

function computeStats(results: TrialResult[]): StrategyStats {
  const n = results.length
  const mean: Record<string, number> = {}
  const ci95: Record<string, [number, number]> = {}

  for (const metric of METRICS) {
    const values = results.map(r => {
      const v = r[metric]
      return v === null ? 0 : v
    })

    const avg = values.reduce((a, b) => a + b, 0) / n
    const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (n - 1)
    const stdErr = Math.sqrt(variance / n)
    const margin = 1.96 * stdErr

    mean[metric] = avg
    ci95[metric] = [avg - margin, avg + margin]
  }

  return { mean, ci95 }
}

export function formatResultsTable(result: BenchmarkResult): string {
  const lines: string[] = []
  const pad = (s: string, len: number) => s.padEnd(len)
  const pct = (v: number, ci: [number, number]) => {
    const margin = ((ci[1] - ci[0]) / 2) * 100
    return `${(v * 100).toFixed(1)}% ± ${margin.toFixed(1)}%`
  }
  const mb = (kb: number, ci: [number, number]) => {
    const margin = (ci[1] - ci[0]) / 2 / 1024
    return `${(kb / 1024).toFixed(1)} ± ${margin.toFixed(1)}`
  }

  const header = `${pad('Strategy', 16)}${pad('Hit Rate', 20)}${pad('Efficiency', 20)}${pad('Bandwidth (MB)', 18)}Convergence`
  lines.push(header)
  lines.push('-'.repeat(header.length))

  const order: StrategyId[] = ['navbandit', 'prefetch-all', 'static-top-k', 'random-k', 'no-prefetch']
  const names: Record<StrategyId, string> = {
    'navbandit': 'NavBandit',
    'prefetch-all': 'Prefetch All',
    'static-top-k': 'Static Top-K',
    'random-k': 'Random K',
    'no-prefetch': 'No Prefetch',
  }

  for (const sid of order) {
    const s = result.strategies[sid]
    const hitRateStr = sid === 'no-prefetch' ? '0.0%' : pct(s.mean.hitRate, s.ci95.hitRate)
    const effStr = sid === 'no-prefetch' ? 'n/a' : pct(s.mean.efficiency, s.ci95.efficiency)
    const bwStr = mb(s.mean.bandwidthKB, s.ci95.bandwidthKB)
    let convStr = 'n/a'
    if (sid === 'navbandit') {
      const conv = s.mean.convergenceNav
      convStr = conv > 0 ? `~${Math.round(conv)} navs` : 'not reached'
    } else if (sid === 'static-top-k') {
      convStr = 'oracle'
    }

    lines.push(
      `${pad(names[sid], 16)}${pad(hitRateStr, 20)}${pad(effStr, 20)}${pad(bwStr, 18)}${convStr}`
    )
  }

  return lines.join('\n')
}
