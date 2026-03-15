export interface BandwidthDecision {
  shouldPrefetch: boolean
  maxPrefetches: number
}

export function checkBandwidth(): BandwidthDecision {
  const conn = (navigator as any).connection
  if (conn?.saveData) return { shouldPrefetch: false, maxPrefetches: 0 }

  const type: string | undefined = conn?.effectiveType
  if (type === 'slow-2g' || type === '2g') return { shouldPrefetch: false, maxPrefetches: 0 }
  if (type === '3g') return { shouldPrefetch: true, maxPrefetches: 1 }

  return { shouldPrefetch: true, maxPrefetches: 3 }
}
