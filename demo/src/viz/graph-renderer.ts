import type { Site } from '../sites'

interface NodePos {
  x: number
  y: number
  label: string
  url: string
}

// Hand-tuned positions for blog topology (viewBox 0 0 380 260)
const BLOG_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  '/':             { x: 190, y: 35,  label: 'Home' },
  '/about':        { x: 65,  y: 115, label: 'About' },
  '/posts':        { x: 190, y: 115, label: 'Posts' },
  '/contact':      { x: 315, y: 115, label: 'Contact' },
  '/posts/hello':  { x: 95,  y: 210, label: 'Hello' },
  '/posts/world':  { x: 190, y: 210, label: 'World' },
  '/posts/tips':   { x: 285, y: 210, label: 'Tips' },
}

export type EdgeState = 'idle' | 'prefetched' | 'prefetched-eager' | 'prefetched-moderate' | 'prefetched-conservative'

export interface GraphUpdate {
  currentPage: string
  /** Map of destination URL → edge state for prefetched edges */
  prefetchedEdges: Map<string, EdgeState>
  /** Flash a specific edge green (hit) or red (miss) */
  flash?: { from: string; to: string; type: 'hit' | 'miss' }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createGraphRenderer(container: HTMLElement, site: Site) {
  const nodes: NodePos[] = []
  const edges: { from: string; to: string }[] = []

  // Build nodes and edges from site topology
  for (const [url, page] of Object.entries(site.pages)) {
    const pos = BLOG_POSITIONS[url]
    if (!pos) continue
    nodes.push({ x: pos.x, y: pos.y, label: pos.label, url })
    for (const link of page.links) {
      if (BLOG_POSITIONS[link]) {
        edges.push({ from: url, to: link })
      }
    }
  }

  // Deduplicate edges (a→b and b→a become one line)
  const edgeSet = new Set<string>()
  const uniqueEdges: { from: string; to: string; key: string }[] = []
  for (const e of edges) {
    const key = [e.from, e.to].sort().join('|')
    if (!edgeSet.has(key)) {
      edgeSet.add(key)
      uniqueEdges.push({ ...e, key })
    }
  }

  // Create SVG
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 380 260')
  svg.setAttribute('class', 'graph-svg')
  container.appendChild(svg)

  // Defs for glow filter
  const defs = document.createElementNS(SVG_NS, 'defs')
  const filter = document.createElementNS(SVG_NS, 'filter')
  filter.setAttribute('id', `glow-${Math.random().toString(36).slice(2, 8)}`)
  filter.setAttribute('x', '-50%')
  filter.setAttribute('y', '-50%')
  filter.setAttribute('width', '200%')
  filter.setAttribute('height', '200%')
  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur')
  blur.setAttribute('stdDeviation', '3')
  blur.setAttribute('result', 'glow')
  const merge = document.createElementNS(SVG_NS, 'feMerge')
  const mn1 = document.createElementNS(SVG_NS, 'feMergeNode')
  mn1.setAttribute('in', 'glow')
  const mn2 = document.createElementNS(SVG_NS, 'feMergeNode')
  mn2.setAttribute('in', 'SourceGraphic')
  merge.appendChild(mn1)
  merge.appendChild(mn2)
  filter.appendChild(blur)
  filter.appendChild(merge)
  defs.appendChild(filter)
  svg.appendChild(defs)
  const filterId = filter.getAttribute('id')!

  // Draw edges
  const edgeEls = new Map<string, SVGLineElement>()
  for (const e of uniqueEdges) {
    const fromPos = BLOG_POSITIONS[e.from]
    const toPos = BLOG_POSITIONS[e.to]
    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(fromPos.x))
    line.setAttribute('y1', String(fromPos.y))
    line.setAttribute('x2', String(toPos.x))
    line.setAttribute('y2', String(toPos.y))
    line.setAttribute('class', 'graph-edge')
    svg.appendChild(line)
    // Store both directions for lookup
    edgeEls.set(`${e.from}|${e.to}`, line)
    edgeEls.set(`${e.to}|${e.from}`, line)
  }

  // Draw nodes
  const nodeEls = new Map<string, SVGGElement>()
  for (const node of nodes) {
    const g = document.createElementNS(SVG_NS, 'g')
    g.setAttribute('class', 'graph-node')

    // Pulse ring (hidden by default)
    const pulseRing = document.createElementNS(SVG_NS, 'circle')
    pulseRing.setAttribute('cx', String(node.x))
    pulseRing.setAttribute('cy', String(node.y))
    pulseRing.setAttribute('r', '24')
    pulseRing.setAttribute('class', 'pulse-ring')
    g.appendChild(pulseRing)

    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('cx', String(node.x))
    circle.setAttribute('cy', String(node.y))
    circle.setAttribute('r', '20')
    circle.setAttribute('class', 'node-circle')
    g.appendChild(circle)

    const text = document.createElementNS(SVG_NS, 'text')
    text.setAttribute('x', String(node.x))
    text.setAttribute('y', String(node.y + 4))
    text.setAttribute('class', 'node-label')
    text.textContent = node.label
    g.appendChild(text)

    svg.appendChild(g)
    nodeEls.set(node.url, g)
  }

  function update(upd: GraphUpdate) {
    // Reset all edges
    for (const line of edgeEls.values()) {
      line.setAttribute('class', 'graph-edge')
      line.style.filter = ''
    }

    // Highlight prefetched edges (from currentPage outward)
    for (const [destUrl, state] of upd.prefetchedEdges) {
      const line = edgeEls.get(`${upd.currentPage}|${destUrl}`)
      if (line) {
        line.setAttribute('class', `graph-edge edge-${state}`)
        if (state !== 'idle') {
          line.style.filter = `url(#${filterId})`
        }
      }
    }

    // Flash hit/miss on the edge that was navigated
    if (upd.flash) {
      const line = edgeEls.get(`${upd.flash.from}|${upd.flash.to}`)
      if (line) {
        line.classList.add(`flash-${upd.flash.type}`)
        line.addEventListener('animationend', () => {
          line.classList.remove(`flash-${upd.flash!.type}`)
        }, { once: true })
      }
    }

    // Update current page indicator
    for (const [url, g] of nodeEls) {
      if (url === upd.currentPage) {
        g.classList.add('current')
      } else {
        g.classList.remove('current')
      }
    }
  }

  return { update }
}
