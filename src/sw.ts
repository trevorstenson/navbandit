import type { BanditConfig, BanditState, ClientMessage, Prediction } from './types'
import { createArm, selectTopK, update } from './linucb'
import { buildContext, type ContextMetadata } from './context'
import { loadState, saveState } from './store'
import { normalizePrefetchUrl, sanitizePredictions, sanitizePrefetchUrls } from './url-policy'

declare const self: ServiceWorkerGlobalScope

const DEFAULT_MAX_STATE_AGE_MS = 30 * 24 * 60 * 60 * 1000

const DEFAULTS: BanditConfig = {
  alpha: 1.0,
  discount: 0.95,
  dimensions: 8,
  topK: 3,
  pruneAfter: 50,
  maxStateAgeMs: DEFAULT_MAX_STATE_AGE_MS,
  maxTrackedLinks: 100,
}

export function createBanditSW(userConfig?: Partial<BanditConfig>) {
  const config = { ...DEFAULTS, ...userConfig }
  const {
    dimensions: d,
    alpha,
    discount,
    topK,
    pruneAfter,
    maxStateAgeMs,
    maxTrackedLinks,
  } = config

  let state: BanditState | null = null
  let lastPredictions: Prediction[] = []
  const meta: ContextMetadata = {
    sessionDepth: 0,
    visitedUrls: new Set(),
    lastNavTime: undefined,
    scrollDepth: 0,
  }

  async function ensureState(): Promise<BanditState> {
    if (!state) {
      state = await loadState(maxStateAgeMs)
      if (!state) {
        state = {
          arms: {},
          totalPulls: 0,
          sessionId: crypto.randomUUID(),
        }
      }
      // Restore visitedUrls set from arm keys
      for (const url of Object.keys(state.arms)) {
        const normalized = normalizePrefetchUrl(url, {
          origin: self.location.origin,
          allowDangerousPaths: true,
        })
        if (normalized) meta.visitedUrls!.add(normalized)
      }
    }
    return state
  }

  function pruneArms(s: BanditState): void {
    for (const url in s.arms) {
      if (s.totalPulls - s.arms[url].lastSeen > pruneAfter) {
        delete s.arms[url]
      }
    }
  }

  async function postPredictions(
    client: Pick<Client, 'postMessage'>,
    predictions: Prediction[]
  ): Promise<void> {
    const safePredictions = sanitizePredictions(predictions, {
      origin: self.location.origin,
      maxUrls: topK,
    })
    if (safePredictions.length === 0) return
    client.postMessage({ type: 'navbandit:predictions', predictions: safePredictions })
  }

  async function broadcastPredictions(predictions: Prediction[]): Promise<void> {
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) {
      await postPredictions(client, predictions)
    }
  }

  function handleFetch(event: FetchEvent): void {
    // Only intercept navigation requests
    if (event.request.mode !== 'navigate') return

    // Skip prefetch requests (don't count them as real navigations)
    const purpose = event.request.headers.get('Sec-Purpose') || event.request.headers.get('Purpose')
    if (purpose === 'prefetch') return

    const url = normalizePrefetchUrl(event.request.url, {
      origin: self.location.origin,
      allowDangerousPaths: true,
    })
    if (!url) return

    event.waitUntil(
      (async () => {
        const s = await ensureState()

        // Full-information feedback: always reward the actual destination
        const destArm = s.arms[url]
        if (destArm) {
          const ctx = buildContext(url, meta)
          update(destArm, ctx, 1.0, discount)
        }

        // Update metadata
        meta.sessionDepth = (meta.sessionDepth ?? 0) + 1
        meta.visitedUrls!.add(url)
        meta.lastNavTime = Date.now()
        meta.scrollDepth = 0
        s.totalPulls++

        // Ensure navigated URL is an arm
        if (!s.arms[url]) {
          s.arms[url] = createArm(d)
        }
        s.arms[url].lastSeen = s.totalPulls

        // Prune old arms
        pruneArms(s)

        // Generate predictions
        const ctx = buildContext(url, meta)
        lastPredictions = sanitizePredictions(selectTopK(s.arms, ctx, topK, alpha), {
          origin: self.location.origin,
          maxUrls: topK,
        })

        // Broadcast to clients
        await broadcastPredictions(lastPredictions)

        // Persist
        await saveState(s)
      })()
    )
  }

  function handleMessage(event: ExtendableMessageEvent): void {
    const msg = event.data as ClientMessage
    if (!msg?.type) return

    event.waitUntil(
      (async () => {
        const s = await ensureState()

        switch (msg.type) {
          case 'navbandit:discover-links': {
            const urls = sanitizePrefetchUrls(msg.urls, {
              origin: self.location.origin,
              maxUrls: maxTrackedLinks,
            })

            for (const url of urls) {
              if (!s.arms[url]) {
                s.arms[url] = createArm(d)
                s.arms[url].lastSeen = s.totalPulls
              }
            }
            // Re-score with new arms and broadcast
            if (meta.lastNavTime) {
              const ctx = buildContext(
                normalizePrefetchUrl((event.source as WindowClient | null)?.url ?? '', {
                  origin: self.location.origin,
                  allowDangerousPaths: true,
                }) ?? '',
                meta
              )
              lastPredictions = sanitizePredictions(selectTopK(s.arms, ctx, topK, alpha), {
                origin: self.location.origin,
                maxUrls: topK,
              })
              const source = event.source as (WindowClient & Pick<Client, 'postMessage'>) | null
              if (source) {
                await postPredictions(source, lastPredictions)
              }
            }
            await saveState(s)
            break
          }
          case 'navbandit:reward': {
            const value = msg.value
            if (!Number.isFinite(value) || value < 0 || value > 1) break
            const url = normalizePrefetchUrl(msg.url, {
              origin: self.location.origin,
              allowDangerousPaths: true,
            })
            if (!url) break
            const arm = s.arms[url]
            if (arm) {
              const ctx = buildContext(url, meta)
              update(arm, ctx, value, discount)
              await saveState(s)
            }
            break
          }
          case 'navbandit:scroll-depth': {
            if (!Number.isFinite(msg.depth)) break
            meta.scrollDepth = Math.min(1, Math.max(0, msg.depth))
            break
          }
        }
      })()
    )
  }

  return { handleFetch, handleMessage }
}
