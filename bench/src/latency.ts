import type { NetworkConfig, NavLatencyResult } from './types.js'

/**
 * Simulate the latency a user experiences for a single navigation,
 * given a set of prefetched links, the actual destination, network
 * conditions, page size, and how long the user spent on the page
 * before clicking (think time).
 *
 * Model:
 * - Browser opens min(N, maxParallel) connections simultaneously
 * - Each connection in a batch gets bandwidth / batchSize
 * - Prefetches queue in batches; batch b starts when batch b-1 finishes
 * - If the correct prefetch completes before the user clicks: latency = 0
 * - If still downloading: latency = remaining download time
 * - If not prefetched (miss): full cold load at full bandwidth
 */
export function simulateNavLatency(
  prefetchedLinks: string[],
  destination: string,
  network: NetworkConfig,
  pageSizeKB: number,
  thinkTimeMs: number
): NavLatencyResult {
  const { bandwidthMbps, rttMs, maxParallelConnections } = network
  const n = prefetchedLinks.length

  // Cold load: single request at full bandwidth
  const coldLatencyMs = transferTimeMs(pageSizeKB, bandwidthMbps, rttMs)

  // No prefetches or miss
  if (n === 0) {
    return {
      actualLatencyMs: coldLatencyMs,
      isHit: false,
      isInstant: false,
      contentionFactor: 1,
    }
  }

  const destIndex = prefetchedLinks.indexOf(destination)
  const isHit = destIndex >= 0

  if (!isHit) {
    return {
      actualLatencyMs: coldLatencyMs,
      isHit: false,
      isInstant: false,
      contentionFactor: n > 0 ? Math.min(n, maxParallelConnections) / n : 1,
    }
  }

  // Determine which batch the destination falls into
  const batchIndex = Math.floor(destIndex / maxParallelConnections)
  const batchSize = Math.min(
    maxParallelConnections,
    n - batchIndex * maxParallelConnections
  )

  // Effective bandwidth per connection in this batch
  const effectiveBwMbps = bandwidthMbps / batchSize
  const contentionFactor = 1 / batchSize

  // Time for one prefetch in a batch to complete
  const batchDurationMs = transferTimeMs(pageSizeKB, effectiveBwMbps, rttMs)

  // When does the destination's batch start?
  // Previous batches all had maxParallelConnections items (except possibly the last)
  let batchStartMs = 0
  for (let b = 0; b < batchIndex; b++) {
    const prevBatchSize = Math.min(maxParallelConnections, n - b * maxParallelConnections)
    const prevBwPerConn = bandwidthMbps / prevBatchSize
    batchStartMs += transferTimeMs(pageSizeKB, prevBwPerConn, rttMs)
  }

  const prefetchCompletionMs = batchStartMs + batchDurationMs

  if (prefetchCompletionMs <= thinkTimeMs) {
    // Prefetch finished before user clicked — instant navigation
    return {
      actualLatencyMs: 0,
      isHit: true,
      isInstant: true,
      contentionFactor,
    }
  }

  // User clicked before prefetch finished — partial wait
  const remainingMs = prefetchCompletionMs - thinkTimeMs
  return {
    actualLatencyMs: remainingMs,
    isHit: true,
    isInstant: false,
    contentionFactor,
  }
}

/** Transfer time in ms for a page of given size over given bandwidth + RTT */
function transferTimeMs(pageSizeKB: number, bandwidthMbps: number, rttMs: number): number {
  // pageSizeKB * 8 = kilobits; bandwidthMbps * 1000 = kilobits/s
  const transferMs = (pageSizeKB * 8) / (bandwidthMbps * 1000) * 1000
  return transferMs + rttMs
}
