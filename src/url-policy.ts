import type { Prediction } from './types'

const DANGEROUS_PATH_RE =
  /(?:^|\/)(?:logout|log-out|signout|sign-out|signoff|sign-off|delete|remove|destroy|purge|unsubscribe|optout|opt-out|deactivate|disable|revoke)(?:\/|$)/i

export interface URLPolicyOptions {
  origin?: string
  maxUrls?: number
  allowDangerousPaths?: boolean
}

export interface DiscoverableAnchor {
  href: string
  target?: string
  dataset?: DOMStringMap
  hasAttribute(name: string): boolean
  getAttribute(name: string): string | null
}

export interface DiscoverableLinkOptions extends URLPolicyOptions {
  currentPath?: string
}

function resolveOrigin(origin?: string): string | null {
  if (origin) return origin
  if (typeof location !== 'undefined' && location.origin) return location.origin
  return null
}

export function isDangerousPrefetchPath(pathname: string): boolean {
  return DANGEROUS_PATH_RE.test(pathname)
}

export function normalizePrefetchUrl(
  input: string,
  options: URLPolicyOptions = {}
): string | null {
  const origin = resolveOrigin(options.origin)
  if (!origin) return null

  try {
    const url = new URL(input, origin)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== origin) {
      return null
    }
    if (url.username || url.password) return null
    if (!options.allowDangerousPaths && isDangerousPrefetchPath(url.pathname)) {
      return null
    }
    return url.origin + url.pathname
  } catch {
    return null
  }
}

export function sanitizePrefetchUrls(
  urls: string[],
  options: URLPolicyOptions = {}
): string[] {
  const sanitized: string[] = []
  const seen = new Set<string>()
  const maxUrls = options.maxUrls ?? Number.POSITIVE_INFINITY

  for (const url of urls) {
    const normalized = normalizePrefetchUrl(url, options)
    if (!normalized || seen.has(normalized)) continue
    sanitized.push(normalized)
    seen.add(normalized)
    if (sanitized.length >= maxUrls) break
  }

  return sanitized
}

export function sanitizePredictions(
  predictions: Prediction[],
  options: URLPolicyOptions = {}
): Prediction[] {
  const sanitized: Prediction[] = []
  const seen = new Set<string>()
  const maxUrls = options.maxUrls ?? Number.POSITIVE_INFINITY

  for (const prediction of predictions) {
    const url = normalizePrefetchUrl(prediction.url, options)
    if (!url || seen.has(url)) continue
    sanitized.push({ ...prediction, url })
    seen.add(url)
    if (sanitized.length >= maxUrls) break
  }

  return sanitized
}

export function getDiscoverableAnchorUrl(
  anchor: DiscoverableAnchor,
  options: DiscoverableLinkOptions = {}
): string | null {
  const origin = resolveOrigin(options.origin)
  if (!origin) return null

  const href = anchor.getAttribute('href') ?? anchor.href
  if (!href) return null
  if (anchor.hasAttribute('download')) return null

  const target = (anchor.getAttribute('target') ?? anchor.target ?? '').trim().toLowerCase()
  if (target && target !== '_self') return null

  const disabled =
    anchor.dataset?.navbandit === 'false' ||
    anchor.dataset?.navbanditPrefetch === 'false' ||
    anchor.getAttribute('data-navbandit') === 'false' ||
    anchor.getAttribute('data-navbandit-prefetch') === 'false'
  if (disabled) return null

  const explicitAllow =
    anchor.dataset?.navbanditPrefetch === 'true' ||
    anchor.getAttribute('data-navbandit-prefetch') === 'true'

  try {
    const resolved = new URL(href, origin)
    if (resolved.search || resolved.hash) return null

    const normalized = normalizePrefetchUrl(resolved.toString(), {
      ...options,
      origin,
      allowDangerousPaths: explicitAllow || options.allowDangerousPaths,
    })
    if (!normalized) return null

    if (options.currentPath && new URL(normalized).pathname === options.currentPath) {
      return null
    }

    return normalized
  } catch {
    return null
  }
}
