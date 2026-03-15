import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  supportsSpeculationRules,
  insertSpeculationRules,
  removeSpeculationRules,
  insertPrefetchLinks,
  removePrefetchLinks,
  prefetch,
  discoverLinks,
} from '../src/prefetch'
import type { Prediction } from '../src/types'

// Minimal DOM mock
function createMockDocument() {
  const elements: any[] = []

  return {
    createElement(tag: string) {
      const el: any = {
        tagName: tag.toUpperCase(),
        dataset: {},
        type: '',
        textContent: '',
        rel: '',
        href: '',
        relList: { supports: () => true },
        remove() {
          const idx = elements.indexOf(el)
          if (idx >= 0) elements.splice(idx, 1)
        },
      }
      return el
    },
    head: {
      appendChild(el: any) {
        elements.push(el)
      },
    },
    querySelectorAll(selector: string) {
      if (selector.includes('script[data-navbandit]')) {
        return elements.filter((e: any) => e.tagName === 'SCRIPT' && e.dataset.navbandit)
      }
      if (selector.includes('link[data-navbandit]')) {
        return elements.filter((e: any) => e.tagName === 'LINK' && e.dataset.navbandit)
      }
      return []
    },
    _elements: elements,
  }
}

describe('prefetch', () => {
  let mockDoc: ReturnType<typeof createMockDocument>

  beforeEach(() => {
    mockDoc = createMockDocument()
    vi.stubGlobal('document', mockDoc)
    vi.stubGlobal('HTMLScriptElement', { supports: () => false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('supportsSpeculationRules', () => {
    it('returns false when not supported', () => {
      vi.stubGlobal('HTMLScriptElement', {})
      expect(supportsSpeculationRules()).toBe(false)
    })

    it('returns true when supported', () => {
      vi.stubGlobal('HTMLScriptElement', { supports: (t: string) => t === 'speculationrules' })
      expect(supportsSpeculationRules()).toBe(true)
    })
  })

  describe('insertSpeculationRules', () => {
    it('inserts a script element with speculation rules JSON', () => {
      const predictions: Prediction[] = [
        { url: '/a', score: 1, confidence: 0.8, eagerness: 'eager' },
        { url: '/b', score: 0.5, confidence: 0.4, eagerness: 'moderate' },
      ]
      insertSpeculationRules(predictions)
      const scripts = mockDoc._elements.filter((e: any) => e.type === 'speculationrules')
      expect(scripts).toHaveLength(1)
      const rules = JSON.parse(scripts[0].textContent)
      expect(rules.prefetch).toHaveLength(2)
    })

    it('does nothing for empty predictions', () => {
      insertSpeculationRules([])
      expect(mockDoc._elements).toHaveLength(0)
    })

    it('removes previous rules before inserting', () => {
      const predictions: Prediction[] = [
        { url: '/a', score: 1, confidence: 0.5, eagerness: 'moderate' },
      ]
      insertSpeculationRules(predictions)
      insertSpeculationRules(predictions)
      const scripts = mockDoc._elements.filter((e: any) => e.type === 'speculationrules')
      expect(scripts).toHaveLength(1)
    })
  })

  describe('insertPrefetchLinks', () => {
    it('inserts link elements', () => {
      insertPrefetchLinks(['/a', '/b'])
      const links = mockDoc._elements.filter((e: any) => e.rel === 'prefetch')
      expect(links).toHaveLength(2)
      expect(links[0].href).toBe('/a')
      expect(links[1].href).toBe('/b')
    })

    it('removes previous links before inserting', () => {
      insertPrefetchLinks(['/a'])
      insertPrefetchLinks(['/b'])
      const links = mockDoc._elements.filter((e: any) => e.rel === 'prefetch')
      expect(links).toHaveLength(1)
      expect(links[0].href).toBe('/b')
    })
  })

  describe('removePrefetchLinks', () => {
    it('removes all navbandit links', () => {
      insertPrefetchLinks(['/a', '/b'])
      expect(mockDoc._elements).toHaveLength(2)
      removePrefetchLinks()
      expect(mockDoc._elements).toHaveLength(0)
    })
  })
})
