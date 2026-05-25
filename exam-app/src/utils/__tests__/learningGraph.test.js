import { describe, it, expect } from 'vitest'
import { getTopicNodes, getPriorityTopics, THPT_TOPIC_GRAPH } from '../learningGraph.js'

// ─── getTopicNodes ────────────────────────────────────────────────────────────

describe('getTopicNodes(null)', () => {
  it('returns 12 nodes (one per THPT_TOPIC_GRAPH entry)', () => {
    const nodes = getTopicNodes(null)
    expect(nodes).toHaveLength(THPT_TOPIC_GRAPH.length)
  })

  it('all nodes have mastery: null when input is null', () => {
    const nodes = getTopicNodes(null)
    nodes.forEach(n => expect(n.mastery).toBeNull())
  })

  it('all nodes have masteryLevel: "unknown" when input is null', () => {
    const nodes = getTopicNodes(null)
    nodes.forEach(n => expect(n.masteryLevel).toBe('unknown'))
  })
})

describe('getTopicNodes([])', () => {
  it('returns 12 nodes with mastery: null when input is empty array', () => {
    const nodes = getTopicNodes([])
    expect(nodes).toHaveLength(THPT_TOPIC_GRAPH.length)
    nodes.forEach(n => expect(n.mastery).toBeNull())
  })

  it('all nodes have masteryLevel: "unknown" when input is empty array', () => {
    const nodes = getTopicNodes([])
    nodes.forEach(n => expect(n.masteryLevel).toBe('unknown'))
  })
})

describe('unlocked logic', () => {
  it('node with no prereqs is unlocked regardless of data', () => {
    const nodes = getTopicNodes(null)
    const noPrereqNodes = nodes.filter(n => n.prereqs.length === 0)
    expect(noPrereqNodes.length).toBeGreaterThan(0)
    noPrereqNodes.forEach(n => expect(n.unlocked).toBe(true))
  })

  it('node with unmet prereqs is locked (prereqs have no data)', () => {
    // limits requires functions — with no data, prereqs are unknown → locked
    const nodes = getTopicNodes(null)
    const limits = nodes.find(n => n.id === 'limits')
    expect(limits.unlocked).toBe(false)
  })

  it('node is unlocked when all prereqs have mastery ≥ 0.5', () => {
    const radarData = [
      { topic: 'Hàm số', score: 0.75 }, // functions — mastery 0.75 ≥ 0.5
    ]
    const nodes = getTopicNodes(radarData)
    const limits = nodes.find(n => n.id === 'limits')
    expect(limits.unlocked).toBe(true)
  })

  it('node is locked when a prereq has mastery < 0.5', () => {
    const radarData = [
      { topic: 'Hàm số', score: 0.3 }, // functions — mastery 0.3 < 0.5
    ]
    const nodes = getTopicNodes(radarData)
    const limits = nodes.find(n => n.id === 'limits')
    expect(limits.unlocked).toBe(false)
  })

  it('node with multiple prereqs is only unlocked when ALL meet ≥ 0.5', () => {
    // complex requires derivatives and vectors
    const radarData = [
      { topic: 'Đạo hàm', score: 0.8 },  // derivatives ≥ 0.5
      { topic: 'Vectơ',   score: 0.3 },  // vectors < 0.5 → still locked
    ]
    const nodes = getTopicNodes(radarData)
    const complex = nodes.find(n => n.id === 'complex')
    expect(complex.unlocked).toBe(false)
  })

  it('node is unlocked when all of multiple prereqs meet ≥ 0.5', () => {
    // derivatives requires limits + functions; limits requires functions
    const radarData = [
      { topic: 'Hàm số',   score: 0.8 }, // functions
      { topic: 'Giới hạn', score: 0.6 }, // limits
    ]
    const nodes = getTopicNodes(radarData)
    const derivatives = nodes.find(n => n.id === 'derivatives')
    expect(derivatives.unlocked).toBe(true)
  })
})

describe('mastery levels', () => {
  it('assigns "mastered" for mastery ≥ 0.7', () => {
    const radarData = [{ topic: 'Hàm số', score: 0.7 }]
    const nodes = getTopicNodes(radarData)
    const fn = nodes.find(n => n.id === 'functions')
    expect(fn.masteryLevel).toBe('mastered')
  })

  it('assigns "mastered" for mastery > 0.7', () => {
    const radarData = [{ topic: 'Hàm số', score: 0.9 }]
    const nodes = getTopicNodes(radarData)
    const fn = nodes.find(n => n.id === 'functions')
    expect(fn.masteryLevel).toBe('mastered')
  })

  it('assigns "learning" for mastery ≥ 0.4 and < 0.7', () => {
    const radarData = [{ topic: 'Hàm số', score: 0.55 }]
    const nodes = getTopicNodes(radarData)
    const fn = nodes.find(n => n.id === 'functions')
    expect(fn.masteryLevel).toBe('learning')
  })

  it('assigns "learning" for mastery exactly 0.4', () => {
    const radarData = [{ topic: 'Hàm số', score: 0.4 }]
    const nodes = getTopicNodes(radarData)
    const fn = nodes.find(n => n.id === 'functions')
    expect(fn.masteryLevel).toBe('learning')
  })

  it('assigns "weak" for mastery < 0.4', () => {
    const radarData = [{ topic: 'Hàm số', score: 0.25 }]
    const nodes = getTopicNodes(radarData)
    const fn = nodes.find(n => n.id === 'functions')
    expect(fn.masteryLevel).toBe('weak')
  })

  it('assigns "weak" for mastery = 0', () => {
    const radarData = [{ topic: 'Hàm số', score: 0 }]
    const nodes = getTopicNodes(radarData)
    const fn = nodes.find(n => n.id === 'functions')
    expect(fn.masteryLevel).toBe('weak')
  })

  it('assigns "unknown" for nodes with no matching radar entry', () => {
    const radarData = [{ topic: 'Hàm số', score: 0.8 }]
    const nodes = getTopicNodes(radarData)
    // combinatorics has no matching entry in this radarData
    const comb = nodes.find(n => n.id === 'combinatorics')
    expect(comb.masteryLevel).toBe('unknown')
    expect(comb.mastery).toBeNull()
  })
})

describe('multiple radar labels mapping to same node (averaging)', () => {
  it('averages scores when two topics map to the same node', () => {
    // 'Tổ hợp' and 'Xác suất' both map to 'combinatorics'
    const radarData = [
      { topic: 'Tổ hợp',  score: 0.6 },
      { topic: 'Xác suất', score: 0.4 },
    ]
    const nodes = getTopicNodes(radarData)
    const comb = nodes.find(n => n.id === 'combinatorics')
    expect(comb.mastery).toBeCloseTo(0.5)
    expect(comb.masteryLevel).toBe('learning')
  })

  it('averages to "mastered" when both scores are high', () => {
    const radarData = [
      { topic: 'Tổ hợp',  score: 0.8 },
      { topic: 'Xác suất', score: 0.9 },
    ]
    const nodes = getTopicNodes(radarData)
    const comb = nodes.find(n => n.id === 'combinatorics')
    expect(comb.mastery).toBeCloseTo(0.85)
    expect(comb.masteryLevel).toBe('mastered')
  })
})

describe('node shape', () => {
  it('each node has required fields: id, label, prereqs, mastery, masteryLevel, prereqsMet, unlocked', () => {
    const nodes = getTopicNodes(null)
    nodes.forEach(n => {
      expect(n).toHaveProperty('id')
      expect(n).toHaveProperty('label')
      expect(n).toHaveProperty('prereqs')
      expect(n).toHaveProperty('mastery')
      expect(n).toHaveProperty('masteryLevel')
      expect(n).toHaveProperty('prereqsMet')
      expect(n).toHaveProperty('unlocked')
    })
  })

  it('prereqsMet is false for nodes with unknown prereqs (no data)', () => {
    const nodes = getTopicNodes(null)
    const limits = nodes.find(n => n.id === 'limits')
    expect(limits.prereqsMet).toBe(false)
  })

  it('prereqsMet is true when all prereqs meet ≥ 0.5', () => {
    const radarData = [{ topic: 'Hàm số', score: 0.6 }]
    const nodes = getTopicNodes(radarData)
    const limits = nodes.find(n => n.id === 'limits')
    expect(limits.prereqsMet).toBe(true)
  })
})

// ─── getPriorityTopics ────────────────────────────────────────────────────────

describe('getPriorityTopics', () => {
  it('returns empty array when no nodes are weak and unlocked', () => {
    const radarData = [
      { topic: 'Hàm số',   score: 0.8 },
      { topic: 'Vectơ',    score: 0.9 },
      { topic: 'Tổ hợp',   score: 0.75 },
      { topic: 'Xác suất', score: 0.8 },
    ]
    const nodes = getTopicNodes(radarData)
    const priority = getPriorityTopics(nodes)
    expect(priority.length).toBe(0)
  })

  it('returns only unlocked weak topics', () => {
    // functions (no prereqs) and vectors (no prereqs) are weak
    // limits (requires functions) — depends on whether functions ≥ 0.5
    const radarData = [
      { topic: 'Hàm số', score: 0.2 }, // weak + unlocked (no prereqs)
      { topic: 'Vectơ',  score: 0.3 }, // weak + unlocked (no prereqs)
    ]
    const nodes = getTopicNodes(radarData)
    const priority = getPriorityTopics(nodes)
    const ids = priority.map(n => n.id)
    expect(ids).toContain('functions')
    expect(ids).toContain('vectors')
    // limits is locked (functions < 0.5) so should NOT appear
    expect(ids).not.toContain('limits')
  })

  it('returns at most 3 topics', () => {
    // Make 4+ no-prereq nodes weak
    const radarData = [
      { topic: 'Hàm số',   score: 0.1 }, // weak + unlocked
      { topic: 'Vectơ',    score: 0.2 }, // weak + unlocked
      { topic: 'Tổ hợp',   score: 0.3 }, // weak + unlocked (combinatorics avg)
      { topic: 'Xác suất', score: 0.2 }, // weak + unlocked (combinatorics avg → 0.25)
      { topic: 'Hình học', score: 0.15 },// weak + unlocked
    ]
    const nodes = getTopicNodes(radarData)
    const priority = getPriorityTopics(nodes)
    expect(priority.length).toBeLessThanOrEqual(3)
  })

  it('sorts weakest first (ascending mastery)', () => {
    const radarData = [
      { topic: 'Hàm số', score: 0.3 }, // weak + unlocked
      { topic: 'Vectơ',  score: 0.1 }, // weak + unlocked — should be first
    ]
    const nodes = getTopicNodes(radarData)
    const priority = getPriorityTopics(nodes)
    expect(priority.length).toBe(2)
    expect(priority[0].mastery).toBeLessThanOrEqual(priority[1].mastery)
    expect(priority[0].id).toBe('vectors') // 0.1 < 0.3
  })

  it('does not include locked nodes even if they are weak', () => {
    // limits is weak but locked because functions is also weak (< 0.5)
    const radarData = [
      { topic: 'Hàm số',   score: 0.2 }, // functions weak → limits locked
      { topic: 'Giới hạn', score: 0.1 }, // limits weak but LOCKED
    ]
    const nodes = getTopicNodes(radarData)
    const priority = getPriorityTopics(nodes)
    const ids = priority.map(n => n.id)
    expect(ids).not.toContain('limits')
    expect(ids).toContain('functions') // functions is unlocked + weak
  })

  it('does not include mastered or learning topics', () => {
    const radarData = [
      { topic: 'Hàm số', score: 0.8 },   // mastered
      { topic: 'Vectơ',  score: 0.55 },  // learning
    ]
    const nodes = getTopicNodes(radarData)
    const priority = getPriorityTopics(nodes)
    const ids = priority.map(n => n.id)
    expect(ids).not.toContain('functions')
    expect(ids).not.toContain('vectors')
  })
})
