import type {
  BenchConfig,
  NetworkConfig,
  PageWeightConfig,
  ScenarioConfig,
  SweepResult,
  StrategyId,
} from './types.js'
import { runBenchmark } from './bench.js'

export const NETWORKS: NetworkConfig[] = [
  { label: 'fast-wifi', bandwidthMbps: 100, rttMs: 20, maxParallelConnections: 6 },
  { label: 'cable', bandwidthMbps: 10, rttMs: 50, maxParallelConnections: 6 },
  { label: '4g', bandwidthMbps: 5, rttMs: 80, maxParallelConnections: 6 },
  { label: '3g', bandwidthMbps: 1, rttMs: 150, maxParallelConnections: 6 },
]

export const PAGE_WEIGHTS: PageWeightConfig[] = [
  { label: 'light', pageSizeKB: 50 },
  { label: 'average', pageSizeKB: 200 },
  { label: 'spa', pageSizeKB: 500 },
  { label: 'heavy-spa', pageSizeKB: 1000 },
]

export function runSweep(baseConfig: BenchConfig): SweepResult {
  const scenarios: SweepResult['scenarios'] = []

  const total = NETWORKS.length * PAGE_WEIGHTS.length
  let current = 0

  for (const network of NETWORKS) {
    for (const pageWeight of PAGE_WEIGHTS) {
      current++
      const scenario: ScenarioConfig = { network, pageWeight }

      console.log(`  [${current}/${total}] ${network.label} + ${pageWeight.label} (${pageWeight.pageSizeKB}KB)...`)

      const config: BenchConfig = {
        ...baseConfig,
        network,
        pageWeight,
      }

      const result = runBenchmark(config)
      scenarios.push({
        scenario,
        strategies: result.strategies,
      })
    }
  }

  return {
    topology: baseConfig.topology,
    traffic: baseConfig.traffic,
    trials: baseConfig.trials,
    navigationsPerTrial: baseConfig.navigationsPerTrial,
    scenarios,
    metadata: {
      timestamp: new Date().toISOString(),
      seed: baseConfig.seed,
    },
  }
}

export function formatSweepTable(result: SweepResult): string {
  const lines: string[] = []
  const pad = (s: string, len: number) => s.padEnd(len)

  lines.push(pad('Network', 12) + pad('Page Size', 12) + pad('NB Latency', 14) + pad('PA Latency', 14) + pad('NB Instant%', 14) + pad('PA Instant%', 14) + 'Winner')
  lines.push('-'.repeat(92))

  for (const { scenario, strategies } of result.scenarios) {
    const nb = strategies['navbandit']
    const pa = strategies['prefetch-all']

    const nbLat = nb.mean.expectedLatencyMs
    const paLat = pa.mean.expectedLatencyMs
    const nbInst = nb.mean.instantNavRate * 100
    const paInst = pa.mean.instantNavRate * 100

    const winner = nbLat < paLat ? 'NavBandit' : nbLat > paLat ? 'Prefetch All' : 'Tie'
    const delta = Math.abs(nbLat - paLat)

    lines.push(
      pad(scenario.network.label, 12) +
      pad(`${scenario.pageWeight.pageSizeKB}KB`, 12) +
      pad(`${nbLat.toFixed(0)}ms`, 14) +
      pad(`${paLat.toFixed(0)}ms`, 14) +
      pad(`${nbInst.toFixed(1)}%`, 14) +
      pad(`${paInst.toFixed(1)}%`, 14) +
      `${winner} (Δ${delta.toFixed(0)}ms)`
    )
  }

  return lines.join('\n')
}
