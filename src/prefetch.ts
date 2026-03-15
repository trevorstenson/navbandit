import type { Prediction } from './types'

/** Detect if the browser supports Speculation Rules API */
export function supportsSpeculationRules(): boolean {
  return (
    typeof HTMLScriptElement !== 'undefined' &&
    'supports' in HTMLScriptElement &&
    (HTMLScriptElement as any).supports('speculationrules')
  )
}

/** Insert a <script type="speculationrules"> element */
export function insertSpeculationRules(predictions: Prediction[]): void {
  removeSpeculationRules()

  if (predictions.length === 0) return

  const groups: Record<string, string[]> = { eager: [], moderate: [], conservative: [] }
  for (const p of predictions) {
    groups[p.eagerness].push(p.url)
  }

  const rules: any[] = []
  for (const [eagerness, urls] of Object.entries(groups)) {
    if (urls.length > 0) {
      rules.push({ source: 'list', urls, eagerness })
    }
  }

  const script = document.createElement('script')
  script.type = 'speculationrules'
  script.dataset.navbandit = 'true'
  script.textContent = JSON.stringify({ prefetch: rules })
  document.head.appendChild(script)
}

export function removeSpeculationRules(): void {
  const existing = document.querySelectorAll<HTMLScriptElement>('script[data-navbandit]')
  for (const el of existing) el.remove()
}

/** Insert <link rel="prefetch"> elements for given URLs */
export function insertPrefetchLinks(urls: string[]): void {
  removePrefetchLinks()

  for (const url of urls) {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    link.dataset.navbandit = 'true'
    document.head.appendChild(link)
  }
}

/** Remove all navbandit-managed prefetch links */
export function removePrefetchLinks(): void {
  const existing = document.querySelectorAll<HTMLLinkElement>('link[data-navbandit]')
  for (const el of existing) el.remove()
}

/** Prefetch URLs using the best available method */
export function prefetch(urls: string[]): void {
  if (urls.length === 0) return

  if (supportsSpeculationRules()) {
    const predictions: Prediction[] = urls.map((url) => ({
      url,
      score: 1,
      confidence: 0.5,
      eagerness: 'moderate' as const,
    }))
    insertSpeculationRules(predictions)
  } else if (supportsLinkPrefetch()) {
    insertPrefetchLinks(urls)
  } else {
    fetchPrefetch(urls)
  }
}

/** Clean up all navbandit-managed prefetch elements */
export function cleanupPrefetch(): void {
  removeSpeculationRules()
  removePrefetchLinks()
}

let _linkPrefetchSupported: boolean | null = null
function supportsLinkPrefetch(): boolean {
  if (_linkPrefetchSupported === null) {
    const link = document.createElement('link')
    _linkPrefetchSupported = link.relList?.supports?.('prefetch') ?? true
  }
  return _linkPrefetchSupported
}

function fetchPrefetch(urls: string[]): void {
  for (const url of urls) {
    fetch(url, { priority: 'low' } as any).catch(() => {})
  }
}

/** Discover same-origin <a> links on the page */
export function discoverLinks(): string[] {
  const origin = location.origin
  const urls = new Set<string>()
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href]')
  for (const a of anchors) {
    try {
      const url = new URL(a.href, origin)
      if (url.origin === origin && url.pathname !== location.pathname) {
        urls.add(url.origin + url.pathname)
      }
    } catch {
      // invalid URL, skip
    }
  }
  return Array.from(urls)
}
