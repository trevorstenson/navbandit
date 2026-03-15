import type { Site } from '../sites'

export interface NaiveStats {
  totalPrefetches: number
  hits: number
  misses: number
  hitRate: number
  efficiency: number
}

export interface NaiveResult {
  prefetchedUrls: string[]
  wasHit: boolean
}

export function createNaiveTracker() {
  let totalPrefetches = 0
  let hits = 0
  let misses = 0
  let lastPrefetched: string[] = []

  return {
    /** Call before navigation. Returns what naive would have prefetched from currentPage. */
    navigate(currentPage: string, nextPage: string, site: Site): NaiveResult {
      // Check if the next page was in our last prefetch set
      const wasHit = lastPrefetched.includes(nextPage)
      if (lastPrefetched.length > 0) {
        if (wasHit) hits++
        else misses++
      }

      // Naive strategy: prefetch ALL outgoing links from the new page
      const page = site.pages[nextPage]
      const prefetchedUrls = page ? [...page.links] : []
      totalPrefetches += prefetchedUrls.length
      lastPrefetched = prefetchedUrls

      return { prefetchedUrls, wasHit }
    },

    stats(): NaiveStats {
      const total = hits + misses
      return {
        totalPrefetches,
        hits,
        misses,
        hitRate: total > 0 ? hits / total : 0,
        efficiency: totalPrefetches > 0 ? hits / totalPrefetches : 0,
      }
    },
  }
}
