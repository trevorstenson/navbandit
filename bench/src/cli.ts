import { runBenchmark, formatResultsTable } from './bench.js'
import type { BenchConfig, TopologyConfig, TrafficConfig } from './types.js'
import { writeFileSync } from 'fs'

function parseArgs(argv: string[]): {
  trials: number
  navs: number
  archetype: 'docs' | 'ecommerce' | 'news' | 'all'
  output: string | null
  seed: number
  k: number
  alpha: number
} {
  const args = {
    trials: 100,
    navs: 500,
    archetype: 'all' as 'docs' | 'ecommerce' | 'news' | 'all',
    output: null as string | null,
    seed: 42,
    k: 3,
    alpha: 1.5,
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

function main() {
  const args = parseArgs(process.argv.slice(2))

  const archetypes: string[] =
    args.archetype === 'all' ? ['docs', 'ecommerce', 'news'] : [args.archetype]

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
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`  Benchmark: ${arch.toUpperCase()} topology`)
    console.log(`  ${args.trials} trials × ${args.navs} navigations | K=${args.k} | alpha=${args.alpha} | seed=${args.seed}`)
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
