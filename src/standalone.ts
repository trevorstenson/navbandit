import { createArm, selectTopK, type Arm } from './ucb1'
import { checkBandwidth } from './bandwidth'
import { prefetch, discoverLinks } from './prefetch'

const STORAGE_KEY = 'navbandit'
const SESSION_KEY = 'navbandit:last'
const DEFAULT_ALPHA = 1.5
const DEFAULT_TOP_K = 3
const PRUNE_AFTER = 50

interface PageState {
  arms: Record<string, Arm>
  totalPulls: number
}

interface StandaloneState {
  pages: Record<string, PageState>
  totalNavigations: number
}

interface SessionData {
  fromPath: string
  predictions: string[]
}

function isValidState(v: unknown): v is StandaloneState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as any
  return typeof s.pages === 'object' && s.pages !== null && typeof s.totalNavigations === 'number'
}

function loadState(): StandaloneState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isValidState(parsed)) return parsed
    }
  } catch {}
  return { pages: {}, totalNavigations: 0 }
}

function saveState(state: StandaloneState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveSession(data: SessionData): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {}
}

function ensurePage(state: StandaloneState, path: string): PageState {
  if (!state.pages[path]) {
    state.pages[path] = { arms: {}, totalPulls: 0 }
  }
  return state.pages[path]
}

function pruneArms(page: PageState, currentNav: number): void {
  for (const url in page.arms) {
    if (currentNav - page.arms[url].lastSeen > PRUNE_AFTER) {
      delete page.arms[url]
    }
  }
}

function currentPath(): string {
  return location.pathname
}

function init(): void {
  const bandwidth = checkBandwidth()
  const state = loadState()
  const path = currentPath()
  state.totalNavigations++

  // Record reward from previous navigation
  const session = loadSession()
  if (session && session.predictions.length > 0) {
    const fromPage = state.pages[session.fromPath]
    if (fromPage) {
      const fullUrl = location.origin + path
      const wasHit = session.predictions.includes(fullUrl)
      if (wasHit) {
        const arm = fromPage.arms[fullUrl]
        if (arm) {
          arm.rewards++
          arm.pulls++
          fromPage.totalPulls++
        }
      }
      // Record miss for predictions that weren't followed
      for (const predUrl of session.predictions) {
        if (predUrl !== fullUrl) {
          const arm = fromPage.arms[predUrl]
          if (arm) {
            arm.pulls++
            fromPage.totalPulls++
          }
        }
      }
    }
  }

  // Persist reward updates immediately so they survive even if DOM never reaches ready
  saveState(state)

  function run() {
    const urls = discoverLinks()
    const page = ensurePage(state, path)

    // Ensure arms exist for all discovered links
    for (const url of urls) {
      if (!page.arms[url]) {
        page.arms[url] = createArm(state.totalNavigations)
      }
      page.arms[url].lastSeen = state.totalNavigations
    }

    // Prune stale arms
    pruneArms(page, state.totalNavigations)

    // Select top-K
    const k = bandwidth.shouldPrefetch
      ? Math.min(DEFAULT_TOP_K, bandwidth.maxPrefetches)
      : 0

    let predictions: string[] = []
    if (k > 0 && Object.keys(page.arms).length > 0) {
      predictions = selectTopK(page.arms, Math.max(1, page.totalPulls), k, DEFAULT_ALPHA)
      prefetch(predictions)
    }

    // Store predictions for reward on next page load
    saveSession({ fromPath: path, predictions })

    // Persist state on pagehide
    function onPageHide() {
      saveState(state)
    }
    window.addEventListener('pagehide', onPageHide)

    // Also save on visibility change (in case pagehide doesn't fire)
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        saveState(state)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true })
  } else {
    run()
  }
}

init()
