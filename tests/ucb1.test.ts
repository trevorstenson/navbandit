import { describe, it, expect } from 'vitest'
import { createArm, ucbScore, selectTopK, type Arm } from '../src/ucb1'

describe('ucb1', () => {
  describe('createArm', () => {
    it('initializes with zero pulls and rewards', () => {
      const arm = createArm(5)
      expect(arm.pulls).toBe(0)
      expect(arm.rewards).toBe(0)
      expect(arm.lastSeen).toBe(5)
    })
  })

  describe('ucbScore', () => {
    it('returns Infinity for unexplored arms', () => {
      const arm = createArm(0)
      expect(ucbScore(arm, 10, 1.0)).toBe(Infinity)
    })

    it('returns exploitation + exploration for explored arms', () => {
      const arm: Arm = { pulls: 4, rewards: 2, lastSeen: 0 }
      const score = ucbScore(arm, 10, 1.0)
      const exploitation = 2 / 4 // 0.5
      const exploration = Math.sqrt(Math.log(10) / 4)
      expect(score).toBeCloseTo(exploitation + exploration)
    })

    it('increases exploration with higher alpha', () => {
      const arm: Arm = { pulls: 4, rewards: 2, lastSeen: 0 }
      const low = ucbScore(arm, 10, 0.5)
      const high = ucbScore(arm, 10, 2.0)
      expect(high).toBeGreaterThan(low)
    })

    it('favors arms with higher reward rate', () => {
      const good: Arm = { pulls: 10, rewards: 9, lastSeen: 0 }
      const bad: Arm = { pulls: 10, rewards: 1, lastSeen: 0 }
      expect(ucbScore(good, 20, 1.0)).toBeGreaterThan(ucbScore(bad, 20, 1.0))
    })
  })

  describe('selectTopK', () => {
    it('returns top K arms by UCB score', () => {
      const arms: Record<string, Arm> = {
        '/a': { pulls: 10, rewards: 9, lastSeen: 0 },
        '/b': { pulls: 10, rewards: 1, lastSeen: 0 },
        '/c': { pulls: 10, rewards: 5, lastSeen: 0 },
      }
      const result = selectTopK(arms, 30, 2, 1.0)
      expect(result).toHaveLength(2)
      expect(result[0]).toBe('/a')
      expect(result[1]).toBe('/c')
    })

    it('returns all arms if fewer than K', () => {
      const arms: Record<string, Arm> = {
        '/a': { pulls: 5, rewards: 3, lastSeen: 0 },
      }
      const result = selectTopK(arms, 5, 3, 1.0)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('/a')
    })

    it('prioritizes unexplored arms', () => {
      const arms: Record<string, Arm> = {
        '/explored': { pulls: 10, rewards: 9, lastSeen: 0 },
        '/new': { pulls: 0, rewards: 0, lastSeen: 0 },
      }
      const result = selectTopK(arms, 10, 1, 1.0)
      expect(result[0]).toBe('/new')
    })

    it('returns empty array for empty arms', () => {
      expect(selectTopK({}, 0, 3, 1.0)).toHaveLength(0)
    })
  })
})
