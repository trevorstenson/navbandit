import { runBenchmark, formatResultsTable } from './bench.js'
import { runSweep, formatSweepTable, NETWORKS, PAGE_WEIGHTS } from './sweep.js'
import type { BenchConfig, TopologyConfig, TrafficConfig, NetworkConfig, PageWeightConfig } from './types.js'
import { writeFileSync } from 'fs'

function parseArgs(argv: string[]) {
  const args = {
    trials: 100,
    navs: 500,
    archetype: 'all' as 'docs' | 'ecommerce' | 'news' | 'all',
    output: null as string | null,
    seed: 42,
    k: 3,
    alpha: 0.5,
    sweep: false,
    network: null as string | null,
    pageSize: null as number | null,
  }

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--trials':
        args.trials = parseInt(argv[++i], 10)
        break
      case '--navs':
        args.navs = parseInt(argv[++i], 10)
        break
      case '--archetype':
        args.archetype = argv[++i] as any
        break
      case '--output':
        args.output = argv[++i]
        break
      case '--seed':
        args.seed = parseInt(argv[++i], 10)
        break
      case '--k':
        args.k = parseInt(argv[++i], 10)
        break
      case '--alpha':
        args.alpha = parseFloat(argv[++i])
        break
      case '--sweep':
        args.sweep = true
        break
      case '--network':
        args.network = argv[++i]
        break
      case '--page-size':
        args.pageSize = parseInt(argv[++i], 10)
        break
    }
  }

  return args
}

const TOPOLOGY_PRESETS: Record<string, TopologyConfig> = {
  docs: { archetype: 'docs', pageCount: 100, linksPerPage: [5, 25], sections: 5 },
  ecommerce: { archetype: 'ecommerce', pageCount: 120, linksPerPage: [4, 20], sections: 6 },
  news: { archetype: 'news', pageCount: 80, linksPerPage: [5, 20], sections: 5 },
}

const TRAFFIC_PRESET: TrafficConfig = {
  sessionLengthMean: 8,
  zipfExponent: 1.2,
  returnVisitorRate: 0.4,
  sectionStickiness: 0.7,
}

function resolveNetwork(label: string): NetworkConfig | null {
  return NETWORKS.find(n => n.label === label) ?? null
}

function resolvePageWeight(sizeKB: number): PageWeightConfig {
  return PAGE_WEIGHTS.find(p => p.pageSizeKB === sizeKB) ?? { label: `${sizeKB}KB`, pageSizeKB: sizeKB }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  // Use first archetype for sweep (sweep is already 16 scenarios, don't multiply by 3)
  const archetype = args.archetype === 'all' && args.sweep ? 'docs' : args.archetype

  if (args.sweep) {
    const arch = archetype as string
    const baseConfig: BenchConfig = {
      topology: TOPOLOGY_PRESETS[arch],
      traffic: TRAFFIC_PRESET,
      trials: args.trials,
      navigationsPerTrial: args.navs,
      k: args.k,
      alpha: args.alpha,
      seed: args.seed,
    }

    console.log(`\n${'='.repeat(92)}`)
    console.log(`  Scenario Sweep: ${arch.toUpperCase()} topology`)
    console.log(`  ${args.trials} trials × ${args.navs} navigations | K=${args.k} | alpha=${args.alpha}`)
    console.log(`  ${NETWORKS.length} networks × ${PAGE_WEIGHTS.length} page sizes = ${NETWORKS.length * PAGE_WEIGHTS.length} scenarios`)
    console.log(`${'='.repeat(92)}\n`)

    const result = runSweep(baseConfig)

    console.log()
    console.log(formatSweepTable(result))
    console.log()

    if (args.output) {
      writeFileSync(args.output, JSON.stringify(result, null, 2))
      console.log(`Sweep results written to ${args.output}`)
    }
    return
  }

  // Single or multi-archetype run
  const archetypes: string[] =
    archetype === 'all' ? ['docs', 'ecommerce', 'news'] : [archetype]

  // Resolve optional network/page-size for latency-enabled run
  const network = args.network ? resolveNetwork(args.network) : undefined
  const pageWeight = args.pageSize ? resolvePageWeight(args.pageSize) : undefined

  const allResults: any[] = []

  for (const arch of archetypes) {
    const config: BenchConfig = {
      topology: TOPOLOGY_PRESETS[arch],
      traffic: TRAFFIC_PRESET,
      trials: args.trials,
      navigationsPerTrial: args.navs,
      k: args.k,
      alpha: args.alpha,
      seed: args.seed,
      network: network ?? undefined,
      pageWeight: pageWeight ?? undefined,
    }

    const extra = network ? ` | ${network.label} ${pageWeight?.pageSizeKB ?? 200}KB` : ''
    console.log(`\n${'='.repeat(80)}`)
    console.log(`  Benchmark: ${arch.toUpperCase()} topology`)
    console.log(`  ${args.trials} trials × ${args.navs} navigations | K=${args.k} | alpha=${args.alpha} | seed=${args.seed}${extra}`)
    console.log(`${'='.repeat(80)}\n`)

    const result = runBenchmark(config)
    allResults.push(result)

    console.log(formatResultsTable(result))
    console.log()
  }

  if (args.output) {
    const output = archetypes.length === 1 ? allResults[0] : allResults
    writeFileSync(args.output, JSON.stringify(output, null, 2))
    console.log(`Results written to ${args.output}`)
  }
}

main()
