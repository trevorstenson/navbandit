import type { Prediction } from '@navbandit/types'

export interface TrackerStats {
  totalPrefetches: number
  hits: number
  navigations: number
  hitRate: number
  wastedPrefetches: number
}

export function createBanditStatsTracker() {
  let totalPrefetches = 0
  let hits = 0
  let navigations = 0
  let lastPredictions: Prediction[] = []

  return {
    /** Record predictions made after a navigation */
    recordPredictions(predictions: Prediction[]) {
      totalPrefetches += predictions.length
      lastPredictions = predictions
    },

    /** Check if the next navigation target was predicted. Call BEFORE navigate. */
    checkHit(nextPage: string): boolean {
      if (lastPredictions.length === 0) return false
      navigations++
      const wasHit = lastPredictions.some((p) => p.url === nextPage)
      if (wasHit) hits++
      return wasHit
    },

    stats(): TrackerStats {
      return {
        totalPrefetches,
        hits,
        navigations,
        hitRate: navigations > 0 ? hits / navigations : 0,
        wastedPrefetches: totalPrefetches - hits,
      }
    },
  }
}

export function createNaiveStatsTracker() {
  let totalPrefetches = 0
  let hits = 0
  let navigations = 0
  let lastPrefetched: string[] = []

  return {
    recordPrefetches(urls: string[]) {
      totalPrefetches += urls.length
      lastPrefetched = urls
    },

    checkHit(nextPage: string): boolean {
      if (lastPrefetched.length === 0) return false
      navigations++
      const wasHit = lastPrefetched.includes(nextPage)
      if (wasHit) hits++
      return wasHit
    },

    stats(): TrackerStats {
      return {
        totalPrefetches,
        hits,
        navigations,
        hitRate: navigations > 0 ? hits / navigations : 0,
        wastedPrefetches: totalPrefetches - hits,
      }
    },
  }
}
