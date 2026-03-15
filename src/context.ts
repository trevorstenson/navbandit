/** Metadata provided by the main thread or accumulated in the SW */
export interface ContextMetadata {
  scrollDepth?: number
  sessionDepth?: number
  visitedUrls?: Set<string>
  lastNavTime?: number
}

const CONNECTION_SCORES: Record<string, number> = {
  '4g': 1,
  '3g': 0.5,
  '2g': 0.25,
  'slow-2g': 0,
}

/** Hash a string to a number in [0, 1) */
function hashString(s: string): number {
  let h = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) // FNV prime
  }
  return ((h >>> 0) % 1000) / 1000
}

/** Build a d=8 context vector from browser APIs and metadata, all normalized [0,1] */
export function buildContext(url: string, meta: ContextMetadata = {}): number[] {
  const now = new Date()
  const pathname = new URL(url, 'http://localhost').pathname

  const routeHash = hashString(pathname)
  const hour = now.getHours() / 24
  const sessionDepth = Math.min(meta.sessionDepth ?? 0, 20) / 20
  const connectionType = getConnectionScore()
  const isReturn = meta.visitedUrls?.has(url) ? 1 : 0
  const timeSinceLastNav = meta.lastNavTime
    ? Math.min((Date.now() - meta.lastNavTime) / 1000, 300) / 300
    : 0.5
  const scrollDepth = meta.scrollDepth ?? 0
  const referrerType = 0.5 // default; main thread can override

  return [routeHash, hour, sessionDepth, connectionType, isReturn, timeSinceLastNav, scrollDepth, referrerType]
}

function getConnectionScore(): number {
  const nav = globalThis.navigator as any
  const conn = nav?.connection
  if (!conn?.effectiveType) return 0.75 // assume decent connection
  return CONNECTION_SCORES[conn.effectiveType] ?? 0.75
}
