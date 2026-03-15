import type { Prediction, SWMessage } from './types'
import {
  supportsSpeculationRules,
  insertSpeculationRules,
  removeSpeculationRules,
  insertPrefetchLinks,
  removePrefetchLinks,
  discoverLinks,
} from './prefetch'
import { checkBandwidth } from './bandwidth'

export interface ClientOptions {
  /** Throttle interval (ms) for scroll depth reporting. Default: 1000 */
  scrollThrottleMs?: number
}

/** Send a message to the controlling service worker */
function sendToSW(msg: any): void {
  navigator.serviceWorker.controller?.postMessage(msg)
}

/**
 * Create the main-thread bandit client.
 * Listens for predictions from the SW, inserts speculation rules, discovers links, reports rewards.
 * Returns a cleanup function.
 */
export function createBanditClient(options?: ClientOptions): () => void {
  const { scrollThrottleMs = 1000 } = options ?? {}
  const useSpecRules = supportsSpeculationRules()

  // Handle predictions from SW
  function onMessage(event: MessageEvent) {
    const msg = event.data as SWMessage
    if (msg?.type !== 'navbandit:predictions') return

    const { shouldPrefetch, maxPrefetches } = checkBandwidth()
    if (!shouldPrefetch) return

    const limited = msg.predictions.slice(0, maxPrefetches)

    if (useSpecRules) {
      insertSpeculationRules(limited)
    } else {
      insertPrefetchLinks(limited.map((p) => p.url))
    }
  }

  navigator.serviceWorker.addEventListener('message', onMessage)

  // Discover links once page is loaded
  function onLoad() {
    const urls = discoverLinks()
    if (urls.length > 0) {
      sendToSW({ type: 'navbandit:discover-links', urls })
    }
  }

  if (document.readyState === 'complete') {
    onLoad()
  } else {
    window.addEventListener('load', onLoad, { once: true })
  }

  // Track scroll depth (throttled)
  let scrollTimer: ReturnType<typeof setTimeout> | null = null
  function onScroll() {
    if (scrollTimer) return
    scrollTimer = setTimeout(() => {
      scrollTimer = null
      const depth = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1)
      sendToSW({ type: 'navbandit:scroll-depth', depth: Math.min(1, Math.max(0, depth)) })
    }, scrollThrottleMs)
  }

  window.addEventListener('scroll', onScroll, { passive: true })

  // Cleanup
  return () => {
    navigator.serviceWorker.removeEventListener('message', onMessage)
    window.removeEventListener('load', onLoad)
    window.removeEventListener('scroll', onScroll)
    if (scrollTimer) clearTimeout(scrollTimer)
    if (useSpecRules) {
      removeSpeculationRules()
    } else {
      removePrefetchLinks()
    }
  }
}
