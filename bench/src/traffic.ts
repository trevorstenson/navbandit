import { RNG } from './rng.js'
import type { Site, TrafficConfig, TrafficMatrix, NavigationStep } from './types.js'

export function generateTrafficMatrix(
  site: Site,
  config: TrafficConfig,
  rng: RNG
): TrafficMatrix {
  const probabilities: Record<string, Record<string, number>> = {}

  for (const page of Object.values(site.pages)) {
    if (page.links.length === 0) {
      probabilities[page.id] = {}
      continue
    }

    // Assign latent attractiveness to each link (stable per page-link pair)
    const attractiveness = page.links.map(() => rng.random())

    // Sort by attractiveness to assign ranks
    const indexed = page.links.map((link, i) => ({ link, attr: attractiveness[i] }))
    indexed.sort((a, b) => b.attr - a.attr)

    // Zipf distribution over ranks
    const s = config.zipfExponent
    const zipfWeights = indexed.map((_, rank) => 1 / Math.pow(rank + 1, s))

    // Apply section stickiness: boost same-section links
    const weights = indexed.map((item, i) => {
      const targetPage = site.pages[item.link]
      const sameSection = targetPage && page.section >= 0 && targetPage.section === page.section
      return zipfWeights[i] * (sameSection ? config.sectionStickiness + 1 : 1)
    })

    // Normalize to probabilities
    const total = weights.reduce((a, b) => a + b, 0)
    const probs: Record<string, number> = {}
    for (let i = 0; i < indexed.length; i++) {
      probs[indexed[i].link] = weights[i] / total
    }
    probabilities[page.id] = probs
  }

  return { probabilities }
}

export function generateTrialSequence(
  site: Site,
  matrix: TrafficMatrix,
  config: TrafficConfig,
  navCount: number,
  rng: RNG
): NavigationStep[] {
  const steps: NavigationStep[] = []
  let currentPage = site.root

  while (steps.length < navCount) {
    // Start a new session
    const isReturn = rng.random() < config.returnVisitorRate

    // Session length from geometric distribution
    const sessionLength = geometricSample(config.sessionLengthMean, rng)

    for (let step = 0; step < sessionLength && steps.length < navCount; step++) {
      const probs = matrix.probabilities[currentPage]
      if (!probs || Object.keys(probs).length === 0) {
        // Dead end — go back to root
        steps.push({ currentPage, destination: site.root, isSessionBoundary: true })
        currentPage = site.root
        break
      }

      const links = Object.keys(probs)
      const weights = links.map(l => probs[l])
      const destIdx = rng.weightedSample(weights)
      const destination = links[destIdx]

      steps.push({
        currentPage,
        destination,
        isSessionBoundary: step === 0 && currentPage === site.root && steps.length > 0,
      })
      currentPage = destination
    }

    // Session ends — return to root for next session
    currentPage = site.root
  }

  return steps
}

function geometricSample(mean: number, rng: RNG): number {
  // Geometric distribution: P(X=k) = (1-p)^(k-1) * p, mean = 1/p
  const p = 1 / mean
  return Math.max(1, Math.floor(Math.log(1 - rng.random()) / Math.log(1 - p)))
}
