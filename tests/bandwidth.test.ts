import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkBandwidth } from '../src/bandwidth'

describe('checkBandwidth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('disables prefetch when saveData is true', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true, effectiveType: '4g' } })
    const result = checkBandwidth()
    expect(result.shouldPrefetch).toBe(false)
    expect(result.maxPrefetches).toBe(0)
  })

  it('disables prefetch on slow-2g', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: 'slow-2g' } })
    expect(checkBandwidth().shouldPrefetch).toBe(false)
  })

  it('disables prefetch on 2g', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: '2g' } })
    expect(checkBandwidth().shouldPrefetch).toBe(false)
  })

  it('limits to 1 prefetch on 3g', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: '3g' } })
    const result = checkBandwidth()
    expect(result.shouldPrefetch).toBe(true)
    expect(result.maxPrefetches).toBe(1)
  })

  it('allows full prefetch on 4g', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: '4g' } })
    const result = checkBandwidth()
    expect(result.shouldPrefetch).toBe(true)
    expect(result.maxPrefetches).toBe(3)
  })

  it('allows full prefetch when connection API is missing', () => {
    vi.stubGlobal('navigator', {})
    const result = checkBandwidth()
    expect(result.shouldPrefetch).toBe(true)
    expect(result.maxPrefetches).toBe(3)
  })
})
