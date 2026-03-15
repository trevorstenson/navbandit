import { createArm, score, update, selectTopK } from '@navbandit/linucb'
import { buildContext } from '@navbandit/context'
import type { ContextMetadata } from '@navbandit/context'
import type { BanditConfig, BanditState, Prediction } from '@navbandit/types'
import type { Site } from './sites'

export interface LogEntry {
  step: number
  type: 'navigate' | 'reward' | 'discover' | 'predictions'
  message: string
}

export interface ArmDetail {
  url: string
  ucb: number
  mean: number
  exploration: number
  pulls: number
  lastSeen: number
  isPredicted: boolean
}

export interface SimSnapshot {
  currentPage: string
  stepCount: number
  arms: ArmDetail[]
  predictions: Prediction[]
  context: number[]
  contextLabels: string[]
  log: LogEntry[]
  config: BanditConfig
}

const CONTEXT_LABELS = [
  'Route Hash',
  'Hour',
  'Session Depth',
  'Connection',
  'Is Return',
  'Time Since Nav',
  'Scroll Depth',
  'Referrer Type',
]

const DEFAULTS: BanditConfig = {
  alpha: 1.0,
  discount: 0.95,
  dimensions: 8,
  topK: 3,
  pruneAfter: 50,
}

export class Simulator extends EventTarget {
  private state: BanditState
  private meta: ContextMetadata
  private config: BanditConfig
  private lastPredictions: Prediction[] = []
  private currentPage = '/'
  private stepCount = 0
  private log: LogEntry[] = []
  private lastContext: number[] = new Array(8).fill(0)
  private site: Site
  private autoPlayTimer: ReturnType<typeof setInterval> | null = null

  constructor(site: Site, config?: Partial<BanditConfig>) {
    super()
    this.site = site
    this.config = { ...DEFAULTS, ...config }
    this.state = { arms: {}, totalPulls: 0, sessionId: 'sim' }
    this.meta = { sessionDepth: 0, visitedUrls: new Set(), lastNavTime: undefined, scrollDepth: 0 }
    // Initialize arms for starting page links
    this.initPage('/')
  }

  private initPage(url: string): void {
    const page = this.site.pages[url]
    if (!page) return
    const d = this.config.dimensions
    if (!this.state.arms[url]) {
      this.state.arms[url] = createArm(d)
      this.state.arms[url].lastSeen = this.state.totalPulls
    }
    for (const link of page.links) {
      if (!this.state.arms[link]) {
        this.state.arms[link] = createArm(d)
        this.state.arms[link].lastSeen = this.state.totalPulls
      }
    }
  }

  navigate(url: string): void {
    const { alpha, discount, topK, dimensions: d } = this.config
    this.stepCount++
    const step = this.stepCount

    // Check for reward — was this URL predicted?
    let rewarded = false
    for (const pred of this.lastPredictions) {
      if (pred.url === url) {
        const arm = this.state.arms[pred.url]
        if (arm) {
          const ctx = buildContext(pred.url, this.meta)
          update(arm, ctx, 1.0, discount)
          rewarded = true
        }
        break
      }
    }

    this.pushLog(step, 'navigate', `Navigate → ${url}`)
    if (rewarded) {
      this.pushLog(step, 'reward', `Reward: ${url} was predicted (+1.0)`)
    }

    // Update metadata
    this.meta.sessionDepth = (this.meta.sessionDepth ?? 0) + 1
    this.meta.visitedUrls!.add(url)
    this.meta.lastNavTime = Date.now()
    this.meta.scrollDepth = 0
    this.state.totalPulls++
    this.currentPage = url

    // Ensure navigated URL has an arm
    if (!this.state.arms[url]) {
      this.state.arms[url] = createArm(d)
    }
    this.state.arms[url].lastSeen = this.state.totalPulls

    // Discover links from site topology
    const page = this.site.pages[url]
    if (page) {
      let discovered = 0
      for (const link of page.links) {
        if (!this.state.arms[link]) {
          this.state.arms[link] = createArm(d)
          discovered++
        }
        this.state.arms[link].lastSeen = this.state.totalPulls
      }
      if (discovered > 0) {
        this.pushLog(step, 'discover', `Discovered ${discovered} new link${discovered > 1 ? 's' : ''}`)
      }
    }

    // Build context and generate predictions
    this.lastContext = buildContext(url, this.meta)
    this.lastPredictions = selectTopK(this.state.arms, this.lastContext, topK, alpha)

    const predStr = this.lastPredictions
      .map((p) => `${p.url} (${p.score.toFixed(2)})`)
      .join(', ')
    this.pushLog(step, 'predictions', `Predictions: ${predStr}`)

    this.emit()
  }

  setConfig(partial: Partial<BanditConfig>): void {
    Object.assign(this.config, partial)
    // Re-score with new config
    if (this.currentPage) {
      this.lastContext = buildContext(this.currentPage, this.meta)
      this.lastPredictions = selectTopK(
        this.state.arms,
        this.lastContext,
        this.config.topK,
        this.config.alpha
      )
    }
    this.emit()
  }

  setSite(site: Site): void {
    this.site = site
    this.reset()
  }

  reset(): void {
    const d = this.config.dimensions
    this.state = { arms: {}, totalPulls: 0, sessionId: 'sim-' + Date.now() }
    this.meta = { sessionDepth: 0, visitedUrls: new Set(), lastNavTime: undefined, scrollDepth: 0 }
    this.lastPredictions = []
    this.currentPage = '/'
    this.stepCount = 0
    this.log = []
    this.lastContext = new Array(d).fill(0)
    this.initPage('/')
    this.emit()
  }

  startAutoPlay(intervalMs = 800): void {
    this.stopAutoPlay()
    this.autoPlayTimer = setInterval(() => {
      const page = this.site.pages[this.currentPage]
      if (!page || page.links.length === 0) return
      const randomLink = page.links[Math.floor(Math.random() * page.links.length)]
      this.navigate(randomLink)
    }, intervalMs)
  }

  stopAutoPlay(): void {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer)
      this.autoPlayTimer = null
    }
  }

  get isAutoPlaying(): boolean {
    return this.autoPlayTimer !== null
  }

  snapshot(): SimSnapshot {
    const { alpha } = this.config
    const predictedUrls = new Set(this.lastPredictions.map((p) => p.url))

    const arms: ArmDetail[] = Object.entries(this.state.arms).map(([url, arm]) => {
      const s = score(arm, this.lastContext, alpha)
      return {
        url,
        ucb: s.ucb,
        mean: s.mean,
        exploration: s.exploration,
        pulls: arm.pulls,
        lastSeen: arm.lastSeen,
        isPredicted: predictedUrls.has(url),
      }
    })
    arms.sort((a, b) => b.ucb - a.ucb)

    return {
      currentPage: this.currentPage,
      stepCount: this.stepCount,
      arms,
      predictions: this.lastPredictions,
      context: this.lastContext,
      contextLabels: CONTEXT_LABELS,
      log: this.log,
      config: { ...this.config },
    }
  }

  private pushLog(step: number, type: LogEntry['type'], message: string): void {
    this.log.unshift({ step, type, message })
    if (this.log.length > 200) this.log.length = 200
  }

  private emit(): void {
    this.dispatchEvent(new Event('change'))
  }
}
