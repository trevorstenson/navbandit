import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { saveState, loadState, clearState } from '../src/store'
import { createArm } from '../src/linucb'
import type { BanditState } from '../src/types'

describe('IDB Store', () => {
  beforeEach(async () => {
    await clearState()
  })

  it('returns null when no state saved', async () => {
    const state = await loadState()
    expect(state).toBeNull()
  })

  it('round-trips bandit state through IDB', async () => {
    const state: BanditState = {
      arms: {
        '/page1': createArm(8),
        '/page2': createArm(8),
      },
      totalPulls: 42,
      sessionId: 'test-session',
    }

    // Modify some arm state
    state.arms['/page1'].pulls = 10
    state.arms['/page1'].lastSeen = 40
    state.arms['/page1'].b[0] = 3.14

    await saveState(state)
    const loaded = await loadState()

    expect(loaded).not.toBeNull()
    expect(loaded!.totalPulls).toBe(42)
    expect(loaded!.sessionId).toBe('test-session')
    expect(Object.keys(loaded!.arms)).toEqual(['/page1', '/page2'])
    expect(loaded!.arms['/page1'].pulls).toBe(10)
    expect(loaded!.arms['/page1'].lastSeen).toBe(40)
    expect(loaded!.arms['/page1'].b[0]).toBeCloseTo(3.14)
    expect(loaded!.arms['/page1'].aInv.length).toBe(64) // 8x8
  })

  it('overwrites previous state on save', async () => {
    const state1: BanditState = {
      arms: { '/a': createArm(4) },
      totalPulls: 1,
      sessionId: 's1',
    }
    const state2: BanditState = {
      arms: { '/b': createArm(4), '/c': createArm(4) },
      totalPulls: 5,
      sessionId: 's2',
    }

    await saveState(state1)
    await saveState(state2)
    const loaded = await loadState()

    expect(loaded!.sessionId).toBe('s2')
    expect(loaded!.totalPulls).toBe(5)
    expect(Object.keys(loaded!.arms)).toEqual(['/b', '/c'])
  })

  it('clearState removes all data', async () => {
    await saveState({
      arms: { '/x': createArm(4) },
      totalPulls: 1,
      sessionId: 'clear-test',
    })
    await clearState()
    expect(await loadState()).toBeNull()
  })
})
