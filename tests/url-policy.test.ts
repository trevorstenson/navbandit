import { describe, expect, it } from 'vitest'
import {
  getDiscoverableAnchorUrl,
  normalizePrefetchUrl,
  sanitizePrefetchUrls,
  sanitizePredictions,
} from '../src/url-policy'
import type { Prediction } from '../src/types'

function makeAnchor(
  href: string,
  attrs: Record<string, string> = {},
  dataset: Record<string, string> = {}
) {
  return {
    href,
    target: attrs.target,
    dataset: dataset as DOMStringMap,
    hasAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(attrs, name)
    },
    getAttribute(name: string) {
      if (name === 'href') return href
      return attrs[name] ?? null
    },
  }
}

describe('url policy', () => {
  it('normalizes same-origin URLs and drops query strings and hashes', () => {
    expect(
      normalizePrefetchUrl('https://example.com/docs/getting-started?from=nav#section', {
        origin: 'https://example.com',
      })
    ).toBe('https://example.com/docs/getting-started')
  })

  it('rejects cross-origin and dangerous paths by default', () => {
    expect(
      normalizePrefetchUrl('https://evil.com/docs', { origin: 'https://example.com' })
    ).toBeNull()
    expect(
      normalizePrefetchUrl('https://example.com/logout', { origin: 'https://example.com' })
    ).toBeNull()
  })

  it('deduplicates and limits sanitized URLs', () => {
    expect(
      sanitizePrefetchUrls(
        [
          'https://example.com/a',
          'https://example.com/a?ref=1',
          'https://example.com/delete',
          'https://example.com/b',
        ],
        { origin: 'https://example.com', maxUrls: 2 }
      )
    ).toEqual(['https://example.com/a', 'https://example.com/b'])
  })

  it('filters invalid predictions while preserving metadata', () => {
    const predictions: Prediction[] = [
      { url: 'https://example.com/a', score: 1, confidence: 0.9, eagerness: 'eager' },
      { url: 'https://example.com/logout', score: 0.8, confidence: 0.5, eagerness: 'moderate' },
    ]

    expect(sanitizePredictions(predictions, { origin: 'https://example.com' })).toEqual([
      { url: 'https://example.com/a', score: 1, confidence: 0.9, eagerness: 'eager' },
    ])
  })

  it('blocks stateful anchors unless explicitly allowed', () => {
    expect(
      getDiscoverableAnchorUrl(makeAnchor('/logout'), {
        origin: 'https://example.com',
        currentPath: '/docs',
      })
    ).toBeNull()

    expect(
      getDiscoverableAnchorUrl(
        makeAnchor('/logout', { 'data-navbandit-prefetch': 'true' }, { navbanditPrefetch: 'true' }),
        {
          origin: 'https://example.com',
          currentPath: '/docs',
        }
      )
    ).toBe('https://example.com/logout')
  })

  it('skips links that should not be auto-prefetched', () => {
    expect(
      getDiscoverableAnchorUrl(makeAnchor('/docs?draft=1'), {
        origin: 'https://example.com',
        currentPath: '/home',
      })
    ).toBeNull()

    expect(
      getDiscoverableAnchorUrl(makeAnchor('/docs', { target: '_blank' }), {
        origin: 'https://example.com',
        currentPath: '/home',
      })
    ).toBeNull()

    expect(
      getDiscoverableAnchorUrl(makeAnchor('/docs'), {
        origin: 'https://example.com',
        currentPath: '/home',
      })
    ).toBe('https://example.com/docs')
  })
})
