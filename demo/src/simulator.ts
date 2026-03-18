import { createArm, ucbScore, selectTopK, type Arm } from '@navbandit/ucb1'
import type { Site } from './sites'

export interface LogEntry {
  step: number
  type: 'navigate' | 'reward' | 'discover' | 'predictions'
  message: string
}

export interface ArmDetail {
  url: string
  ucb: number
  rewardRate: number
  pulls: number
  lastSeen: number
  isPredicted: boolean
}

export interface SimConfig {
  alpha: number
  topK: number
}

export interface SimPrediction {
  url: string
  score: number
}

export interface SimSnapshot {
  currentPage: string
  stepCount: number
  arms: ArmDetail[]
  predictions: SimPrediction[]
  log: LogEntry[]
  config: SimConfig
}

const DEFAULTS: SimConfig = {
  alpha: 1.5,
  topK: 3,
}

interface PageState {
  arms: Record<string, Arm>
  totalPulls: number
}

export class Simulator extends EventTarget {
  private pages: Record<string, PageState> = {}
  private config: SimConfig
  private lastPredictions: string[] = []
  private currentPage = '/'
  private stepCount = 0
  private log: LogEntry[] = []
  private site: Site
  private autoPlayTimer: ReturnType<typeof setInterval> | null = null

  constructor(site: Site, config?: Partial<SimConfig>) {
    super()
    this.site = site
    this.config = { ...DEFAULTS, ...config }
    this.initPage('/')
  }

  private ensurePage(path: string): PageState {
    if (!this.pages[path]) {
      this.pages[path] = { arms: {}, totalPulls: 0 }
    }
    return this.pages[path]
  }

  private initPage(url: string): void {
    const page = this.site.pages[url]
    if (!page) return
    const ps = this.ensurePage(url)
    for (const link of page.links) {
      if (!ps.arms[link]) {
        ps.arms[link] = createArm(0)
      }
    }
  }

  navigate(url: string): void {
    const { alpha, topK } = this.config
    this.stepCount++
    const step = this.stepCount

    // Full-information feedback: always reward the actual destination
    let rewarded = false
    const prevPage = this.pages[this.currentPage]
    if (prevPage) {
      // Always reward the clicked arm
      const destArm = prevPage.arms[url]
      if (destArm) {
        destArm.rewards++
        destArm.pulls++
        prevPage.totalPulls++
        rewarded = this.lastPredictions.includes(url)
      }

      // Penalize predictions that weren't followed
      for (const predUrl of this.lastPredictions) {
        if (predUrl !== url) {
          const arm = prevPage.arms[predUrl]
          if (arm) {
            arm.pulls++
            prevPage.totalPulls++
          }
        }
      }
    }

    this.pushLog(step, 'navigate', `Navigate → ${url}`)
    if (rewarded) {
      this.pushLog(step, 'reward', `Reward: ${url} was predicted (+1.0)`)
    }

    this.currentPage = url

    // Ensure page and arms exist
    this.initPage(url)
    const currentPageState = this.ensurePage(url)

    // Discover links from site topology
    const page = this.site.pages[url]
    if (page) {
      let discovered = 0
      for (const link of page.links) {
        if (!currentPageState.arms[link]) {
          currentPageState.arms[link] = createArm(this.stepCount)
          discovered++
        }
        currentPageState.arms[link].lastSeen = this.stepCount
      }
      if (discovered > 0) {
        this.pushLog(step, 'discover', `Discovered ${discovered} new link${discovered > 1 ? 's' : ''}`)
      }
    }

    // Generate predictions from current page's arms
    this.lastPredictions = selectTopK(
      currentPageState.arms,
      Math.max(1, currentPageState.totalPulls),
      topK,
      alpha
    )

    const predStr = this.lastPredictions
      .map((url) => {
        const arm = currentPageState.arms[url]
        const score = arm ? ucbScore(arm, Math.max(1, currentPageState.totalPulls), alpha) : 0
        return `${url} (${isFinite(score) ? score.toFixed(2) : '∞'})`
      })
      .join(', ')
    this.pushLog(step, 'predictions', `Predictions: ${predStr}`)

    this.emit()
  }

  setConfig(partial: Partial<SimConfig>): void {
    Object.assign(this.config, partial)
    // Re-score with new config
    const currentPageState = this.pages[this.currentPage]
    if (currentPageState) {
      this.lastPredictions = selectTopK(
        currentPageState.arms,
        Math.max(1, currentPageState.totalPulls),
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
    this.pages = {}
    this.lastPredictions = []
    this.currentPage = '/'
    this.stepCount = 0
    this.log = []
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
    const predictedUrls = new Set(this.lastPredictions)
    const currentPageState = this.pages[this.currentPage]

    const arms: ArmDetail[] = currentPageState
      ? Object.entries(currentPageState.arms).map(([url, arm]) => {
          const score = ucbScore(arm, Math.max(1, currentPageState.totalPulls), alpha)
          return {
            url,
            ucb: score,
            rewardRate: arm.pulls > 0 ? arm.rewards / arm.pulls : 0,
            pulls: arm.pulls,
            lastSeen: arm.lastSeen,
            isPredicted: predictedUrls.has(url),
          }
        })
      : []
    arms.sort((a, b) => (isFinite(b.ucb) ? b.ucb : 1e9) - (isFinite(a.ucb) ? a.ucb : 1e9))

    const predictions: SimPrediction[] = this.lastPredictions.map((url) => {
      const arm = currentPageState?.arms[url]
      const score = arm ? ucbScore(arm, Math.max(1, currentPageState!.totalPulls), alpha) : Infinity
      return { url, score }
    })

    return {
      currentPage: this.currentPage,
      stepCount: this.stepCount,
      arms,
      predictions,
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
