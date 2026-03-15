import { blog } from './sites'
import { createArm, selectTopK, update } from '@navbandit/linucb'
import type { ArmState, Prediction } from '@navbandit/types'
import { createGraphRenderer, type EdgeState } from './viz/graph-renderer'
import { NAVIGATION_SEQUENCE } from './viz/sequence'
import './viz/viz-styles.css'

// --- Pre-compute all frames ---

interface Frame {
  currentPage: string
  naivePrefetched: string[]
  naiveHit: boolean
  banditPrefetched: Prediction[]
  banditHit: boolean
  flashFrom: string
  naiveStats: { totalPrefetches: number; hits: number; wasted: number }
  banditStats: { totalPrefetches: number; hits: number; wasted: number }
}

function computeAllFrames(): Frame[] {
  const D = 4
  const ALPHA = 1.5
  const DISCOUNT = 0.95
  const TOP_K = 2

  const arms: Record<string, ArmState> = {}
  for (const url of Object.keys(blog.pages)) {
    arms[url] = createArm(D)
  }

  function stableContext(url: string): number[] {
    let h = 0
    for (let i = 0; i < url.length; i++) h = ((h << 5) - h + url.charCodeAt(i)) | 0
    return [((h >>> 0) % 1000) / 1000, 0.5, 0.5, 0.5]
  }

  function getCandidateArms(page: string): Record<string, ArmState> {
    const out: Record<string, ArmState> = {}
    const p = blog.pages[page]
    if (p) {
      for (const link of p.links) {
        if (arms[link]) out[link] = arms[link]
      }
    }
    return out
  }

  let currentPage = '/'
  let lastBanditPreds: Prediction[] = []
  let lastNaivePrefetched: string[] = []

  // Seed from '/'
  const initLinks = blog.pages['/']?.links ?? []
  lastNaivePrefetched = initLinks
  lastBanditPreds = selectTopK(getCandidateArms('/'), stableContext('/'), TOP_K, ALPHA)

  let nTotalPrefetches = initLinks.length
  let nHits = 0
  let bTotalPrefetches = lastBanditPreds.length
  let bHits = 0

  const frames: Frame[] = []

  for (let i = 0; i < NAVIGATION_SEQUENCE.length; i++) {
    const nextPage = NAVIGATION_SEQUENCE[i]

    // Check hits against PREVIOUS page's prefetches
    const naiveHit = lastNaivePrefetched.includes(nextPage)
    const banditHit = lastBanditPreds.some((p) => p.url === nextPage)

    if (naiveHit) nHits++
    if (banditHit) bHits++

    // Reward bandit arm if hit
    if (banditHit && arms[nextPage]) {
      update(arms[nextPage], stableContext(currentPage), 1.0, DISCOUNT)
    }

    const flashFrom = currentPage
    currentPage = nextPage

    // New prefetches from the new page
    const newNaiveLinks = blog.pages[nextPage]?.links ?? []
    nTotalPrefetches += newNaiveLinks.length

    const newBanditPreds = selectTopK(getCandidateArms(nextPage), stableContext(nextPage), TOP_K, ALPHA)
    bTotalPrefetches += newBanditPreds.length

    frames.push({
      currentPage: nextPage,
      naivePrefetched: newNaiveLinks,
      naiveHit,
      banditPrefetched: newBanditPreds.map((p) => ({ ...p })),
      banditHit,
      flashFrom,
      naiveStats: { totalPrefetches: nTotalPrefetches, hits: nHits, wasted: nTotalPrefetches - nHits },
      banditStats: { totalPrefetches: bTotalPrefetches, hits: bHits, wasted: bTotalPrefetches - bHits },
    })

    lastNaivePrefetched = newNaiveLinks
    lastBanditPreds = newBanditPreds
  }

  return frames
}

const frames = computeAllFrames()

// --- DOM ---
const root = document.getElementById('viz-root')!
root.innerHTML = `
  <div class="viz-header">
    <span class="naive-label">Naive Prefetch</span>
    <span class="vs">vs</span>
    <span class="bandit-label">navbandit</span>
  </div>
  <div class="viz-panels">
    <div class="viz-panel">
      <div class="panel-title naive">Naive Prefetch</div>
      <div class="panel-legend">
        <span class="legend-item"><span class="legend-swatch swatch-prefetch-naive"></span>prefetched</span>
        <span class="legend-item"><span class="legend-swatch swatch-hit"></span>hit</span>
        <span class="legend-item"><span class="legend-swatch swatch-miss"></span>miss</span>
        <span class="legend-item"><span class="legend-swatch swatch-current"></span>current</span>
      </div>
      <div class="graph-container" id="naive-graph"></div>
      <div class="panel-stats" id="naive-stats"></div>
    </div>
    <div class="viz-panel">
      <div class="panel-title bandit">navbandit</div>
      <div class="panel-legend">
        <span class="legend-item"><span class="legend-swatch swatch-prefetch-bandit"></span>predicted</span>
        <span class="legend-item"><span class="legend-swatch swatch-hit"></span>hit</span>
        <span class="legend-item"><span class="legend-swatch swatch-miss"></span>miss</span>
        <span class="legend-item"><span class="legend-swatch swatch-current"></span>current</span>
      </div>
      <div class="graph-container" id="bandit-graph"></div>
      <div class="panel-stats" id="bandit-stats"></div>
    </div>
  </div>
  <div class="spec-rules-row">
    <div class="spec-rules-panel">
      <div class="spec-rules-label naive">Naive Speculation Rules</div>
      <pre class="spec-rules-code" id="naive-spec"></pre>
    </div>
    <div class="spec-rules-panel">
      <div class="spec-rules-label bandit">navbandit Speculation Rules</div>
      <pre class="spec-rules-code" id="bandit-spec"></pre>
    </div>
  </div>
  <div class="viz-bottom">
    <div class="viz-controls">
      <button class="step-btn" id="step-back">◀</button>
      <button class="play-btn" id="play-btn">▶</button>
      <button class="step-btn" id="step-fwd">▶</button>
      <span class="step-label" id="step-label">Step 0/${frames.length}</span>
    </div>
    <input type="range" class="scrubber" id="scrubber" min="0" max="${frames.length}" value="0" />
    <span class="viz-status" id="viz-status">Ready</span>
  </div>
`

const naiveGraph = createGraphRenderer(document.getElementById('naive-graph')!, blog)
const banditGraph = createGraphRenderer(document.getElementById('bandit-graph')!, blog)

const naiveStatsEl = document.getElementById('naive-stats')!
const banditStatsEl = document.getElementById('bandit-stats')!
const stepLabelEl = document.getElementById('step-label')!
const scrubberEl = document.getElementById('scrubber')! as HTMLInputElement
const playBtnEl = document.getElementById('play-btn')!
const stepBackEl = document.getElementById('step-back')!
const stepFwdEl = document.getElementById('step-fwd')!
const vizStatusEl = document.getElementById('viz-status')!
const naiveSpecEl = document.getElementById('naive-spec')!
const banditSpecEl = document.getElementById('bandit-spec')!

function renderStats(el: HTMLElement, stats: { totalPrefetches: number; hits: number; wasted: number }, type: 'naive' | 'bandit') {
  const wastedClass = type === 'bandit' ? 'highlight-good' : 'highlight-bad'
  el.innerHTML = `
    <div class="stat">
      <span class="stat-label">Prefetches:</span>
      <span class="stat-value">${stats.totalPrefetches}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Hits:</span>
      <span class="stat-value">${stats.hits}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Wasted:</span>
      <span class="stat-value ${wastedClass}">${stats.wasted}</span>
    </div>
  `
}

function buildSpecRulesJSON(urls: string[], eagernessMap?: Map<string, string>): string {
  if (urls.length === 0) return '{ "prefetch": [] }'
  if (!eagernessMap) {
    // Naive: all eager
    return JSON.stringify({
      prefetch: [{ source: 'list', urls, eagerness: 'eager' }]
    }, null, 2)
  }
  // Bandit: group by eagerness
  const groups: Record<string, string[]> = {}
  for (const url of urls) {
    const e = eagernessMap.get(url) ?? 'moderate'
    if (!groups[e]) groups[e] = []
    groups[e].push(url)
  }
  const rules = Object.entries(groups).map(([eagerness, u]) => ({
    source: 'list', urls: u, eagerness,
  }))
  return JSON.stringify({ prefetch: rules }, null, 2)
}

function renderFrame(index: number) {
  if (index < 0 || index >= frames.length) {
    // Step 0: show initial state
    naiveGraph.update({ currentPage: '/', prefetchedEdges: new Map() })
    banditGraph.update({ currentPage: '/', prefetchedEdges: new Map() })
    renderStats(naiveStatsEl, { totalPrefetches: 0, hits: 0, wasted: 0 }, 'naive')
    renderStats(banditStatsEl, { totalPrefetches: 0, hits: 0, wasted: 0 }, 'bandit')
    naiveSpecEl.textContent = '{ "prefetch": [] }'
    banditSpecEl.textContent = '{ "prefetch": [] }'
    stepLabelEl.textContent = `Step 0/${frames.length}`
    vizStatusEl.textContent = 'Ready'
    return
  }

  const f = frames[index]

  // Naive graph
  const naiveEdges = new Map<string, EdgeState>()
  for (const url of f.naivePrefetched) naiveEdges.set(url, 'prefetched')
  naiveGraph.update({
    currentPage: f.currentPage,
    prefetchedEdges: naiveEdges,
    flash: { from: f.flashFrom, to: f.currentPage, type: f.naiveHit ? 'hit' : 'miss' },
  })

  // Bandit graph
  const banditEdges = new Map<string, EdgeState>()
  for (const pred of f.banditPrefetched) {
    banditEdges.set(pred.url, `prefetched-${pred.eagerness}` as EdgeState)
  }
  banditGraph.update({
    currentPage: f.currentPage,
    prefetchedEdges: banditEdges,
    flash: { from: f.flashFrom, to: f.currentPage, type: f.banditHit ? 'hit' : 'miss' },
  })

  renderStats(naiveStatsEl, f.naiveStats, 'naive')
  renderStats(banditStatsEl, f.banditStats, 'bandit')

  // Speculation Rules JSON
  naiveSpecEl.textContent = buildSpecRulesJSON(f.naivePrefetched)
  const banditEagernessMap = new Map(f.banditPrefetched.map((p) => [p.url, p.eagerness]))
  banditSpecEl.textContent = buildSpecRulesJSON(
    f.banditPrefetched.map((p) => p.url),
    banditEagernessMap
  )

  const step = index + 1
  stepLabelEl.textContent = `Step ${step}/${frames.length}`
  vizStatusEl.textContent = step <= 8 ? 'Exploring...' : step <= 16 ? 'Learning...' : step <= 24 ? 'Converging...' : step < frames.length ? 'Converged' : 'Complete'
}

// --- Scrubber ---
scrubberEl.addEventListener('input', () => {
  const val = parseInt(scrubberEl.value)
  stopAutoPlay()
  autoPlayIndex = val
  renderFrame(val - 1)
})

// --- Auto-play ---
let autoPlayTimer: ReturnType<typeof setTimeout> | null = null
let autoPlayIndex = 0

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer)
    autoPlayTimer = null
  }
  playBtnEl.textContent = '▶'
}

function startAutoPlay() {
  playBtnEl.textContent = '⏸'
  function tick() {
    if (autoPlayIndex >= frames.length) {
      stopAutoPlay()
      return
    }
    renderFrame(autoPlayIndex)
    scrubberEl.value = String(autoPlayIndex + 1)
    autoPlayIndex++
    const delay = autoPlayIndex <= 8 ? 600 : autoPlayIndex <= 16 ? 500 : 400
    autoPlayTimer = setTimeout(tick, delay)
  }
  tick()
}

playBtnEl.addEventListener('click', () => {
  if (autoPlayTimer) {
    stopAutoPlay()
  } else {
    // If at the end, restart
    if (autoPlayIndex >= frames.length) {
      autoPlayIndex = 0
      scrubberEl.value = '0'
    }
    startAutoPlay()
  }
})

function stepTo(index: number) {
  stopAutoPlay()
  autoPlayIndex = Math.max(0, Math.min(frames.length, index))
  scrubberEl.value = String(autoPlayIndex)
  renderFrame(autoPlayIndex - 1)
}

stepBackEl.addEventListener('click', () => stepTo(autoPlayIndex - 1))
stepFwdEl.addEventListener('click', () => stepTo(autoPlayIndex + 1))

// --- Initial render ---
renderFrame(-1)

// Auto-start
setTimeout(() => startAutoPlay(), 500)
