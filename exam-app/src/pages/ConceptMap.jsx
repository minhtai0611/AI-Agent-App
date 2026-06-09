import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  Handle, Position,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'
import { useAuth } from '../context/AuthContext.jsx'
import { getConceptMastery } from '../api/aiClient.js'
import { CONCEPTS, TOPIC_COLORS } from '../data/concepts.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

// ── Mastery colour ────────────────────────────────────────────────────────────
function masteryColor(score) {
  if (score === 0 || score === undefined) return '#1E2A44'   // grey — never tried
  if (score < 0.4) return '#7F1D1D'   // red
  if (score < 0.7) return '#78350F'   // amber
  return '#14532D'                     // green
}
function masteryBorder(score) {
  if (score === 0 || score === undefined) return '#334155'
  if (score < 0.4) return '#EF4444'
  if (score < 0.7) return '#F59E0B'
  return '#22C55E'
}

// ── Dagre layout ──────────────────────────────────────────────────────────────
const NODE_W = 160
const NODE_H = 52

function layoutGraph(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 24 })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } }
  })
}

// ── Custom node ───────────────────────────────────────────────────────────────
function ConceptNode({ data }) {
  const size = 8 + data.exam_weight * 2   // font size proportional to weight
  return (
    <div
      style={{
        background: masteryColor(data.mastery_score),
        border: `1.5px solid ${masteryBorder(data.mastery_score)}`,
        borderRadius: 10,
        padding: '6px 10px',
        width: NODE_W,
        minHeight: NODE_H,
        cursor: 'pointer',
        boxShadow: data.selected ? `0 0 0 2px #F2A20C` : undefined,
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#334155' }} />
      <div style={{ fontSize: Math.max(10, Math.min(13, size)), fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: '#F0F4FF', lineHeight: 1.3 }}>
        {data.name_vi}
      </div>
      <div style={{ fontSize: 9, color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 2 }}>
        Lớp {data.grade} · {Math.round((data.mastery_score || 0) * 100)}%
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#334155' }} />
    </div>
  )
}

const nodeTypes = { concept: ConceptNode }

// ── Prerequisite gap trace ────────────────────────────────────────────────────
function findRootWeakness(conceptId, masteryMap) {
  const visited = new Set()
  const chain = []

  function dfs(id) {
    if (visited.has(id)) return
    visited.add(id)
    const c = CONCEPTS.find(x => x.id === id)
    if (!c) return
    const score = masteryMap[id] || 0
    if (score < 0.4) chain.push(id)
    c.prerequisite_ids.forEach(dfs)
  }

  dfs(conceptId)
  // Return the last (earliest prerequisite) weak node
  return chain[chain.length - 1] ?? conceptId
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ConceptMap() {
  usePageMeta('Bản đồ khái niệm', { noindex: true })
  const navigate = useNavigate()
  const { user } = useAuth()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [masteryMap, setMasteryMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [gradeFilter, setGradeFilter] = useState(0)   // 0 = all

  // ── Fetch mastery ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    getConceptMastery().then(({ data }) => {
      if (data?.concepts) {
        const map = {}
        data.concepts.forEach(c => { map[c.id] = c.mastery_score ?? 0 })
        setMasteryMap(map)
      }
      setLoading(false)
    })
  }, [user?.id])

  // ── Build graph ────────────────────────────────────────────────────────────
  useEffect(() => {
    const filtered = gradeFilter === 0
      ? CONCEPTS
      : CONCEPTS.filter(c => c.grade === gradeFilter)

    const filteredIds = new Set(filtered.map(c => c.id))

    const rawNodes = filtered.map(c => ({
      id: c.id,
      type: 'concept',
      data: {
        ...c,
        mastery_score: masteryMap[c.id] ?? 0,
        selected: selected === c.id,
      },
      position: { x: 0, y: 0 },
    }))

    const rawEdges = []
    filtered.forEach(c => {
      c.prerequisite_ids.forEach(prereqId => {
        if (filteredIds.has(prereqId)) {
          rawEdges.push({
            id: `${prereqId}->${c.id}`,
            source: prereqId,
            target: c.id,
            animated: false,
            style: { stroke: '#334155', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
          })
        }
      })
    })

    const laid = layoutGraph(rawNodes, rawEdges)
    setNodes(laid)
    setEdges(rawEdges)
  }, [masteryMap, gradeFilter, selected])

  // ── Highlight gap trace ────────────────────────────────────────────────────
  const gapChain = useMemo(() => {
    if (!selected) return new Set()
    const chain = new Set()
    const visited = new Set()
    function dfs(id) {
      if (visited.has(id)) return
      visited.add(id)
      const c = CONCEPTS.find(x => x.id === id)
      if (!c) return
      chain.add(id)
      c.prerequisite_ids.forEach(dfs)
    }
    dfs(selected)
    return chain
  }, [selected])

  // ── Highlight edges for gap trace ─────────────────────────────────────────
  useEffect(() => {
    if (!selected) return
    setEdges(eds => eds.map(e => {
      const inChain = gapChain.has(e.source) && gapChain.has(e.target)
      return {
        ...e,
        style: inChain
          ? { stroke: '#F2A20C', strokeWidth: 2.5 }
          : { stroke: '#1E2A44', strokeWidth: 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: inChain ? '#F2A20C' : '#1E2A44' },
      }
    }))
  }, [gapChain, selected])

  const selectedConcept = useMemo(
    () => selected ? CONCEPTS.find(c => c.id === selected) : null,
    [selected]
  )
  const selectedMastery = selected ? (masteryMap[selected] ?? 0) : 0
  const rootWeak = selected ? findRootWeakness(selected, masteryMap) : null
  const rootConcept = rootWeak ? CONCEPTS.find(c => c.id === rootWeak) : null

  const onNodeClick = useCallback((_, node) => {
    setSelected(prev => prev === node.id ? null : node.id)
  }, [])

  // ── Legend ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = CONCEPTS.length
    const tried = Object.values(masteryMap).filter(v => v > 0).length
    const strong = Object.values(masteryMap).filter(v => v >= 0.7).length
    return { total, tried, strong }
  }, [masteryMap])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/exams?mode=lab')}
            className="font-jakarta text-[0.8125rem] text-dim hover:text-muted transition">
            ← Lab
          </button>
          <span className="font-fraunces text-[18px] font-bold text-foreground">Bản đồ khái niệm</span>
        </div>
        <div className="flex items-center gap-2">
          {[0, 9, 10, 11, 12].map(g => (
            <button key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-3 py-1.5 rounded-full font-jakarta text-[0.6875rem] transition ${
                gradeFilter === g
                  ? 'bg-primary text-primary-fg font-bold'
                  : 'border border-border text-dim hover:text-muted'
              }`}>
              {g === 0 ? 'Tất cả' : `Lớp ${g}`}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 px-6 py-2 bg-surface border-b border-border">
        <span className="font-jakarta text-[0.6875rem] text-faint">{stats.total} khái niệm</span>
        <span className="font-jakarta text-[0.6875rem] text-[#60A5FA]">{stats.tried} đã học</span>
        <span className="font-jakarta text-[0.6875rem] text-[#22C55E]">{stats.strong} thành thạo ≥70%</span>
        <div className="ml-auto flex items-center gap-3">
          {[['#14532D','#22C55E','≥70%'],['#78350F','#F59E0B','40-69%'],['#7F1D1D','#EF4444','<40%'],['#1E2A44','#334155','Chưa học']].map(([bg,border,label]) => (
            <span key={label} className="flex items-center gap-1 font-jakarta text-[0.625rem] text-dim">
              <span style={{ width: 10, height: 10, background: bg, border: `1.5px solid ${border}`, borderRadius: 2, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Flow canvas */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="font-jakarta text-[0.8125rem] text-faint">Đang tải bản đồ...</span>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              style={{ background: '#0A0E1A' }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#1E2A44" gap={24} />
              <Controls style={{ background: '#0D1221', borderColor: '#1E2A44' }} />
              <MiniMap
                nodeColor={n => masteryColor(n.data?.mastery_score)}
                style={{ background: '#0D1221', border: '1px solid #1E2A44' }}
              />
            </ReactFlow>
          )}
        </div>

        {/* Detail panel */}
        {selectedConcept && (
          <div className="w-72 border-l border-border bg-surface flex flex-col gap-4 p-5 overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-fraunces text-[16px] font-bold text-foreground">{selectedConcept.name_vi}</span>
                <div className="font-jakarta text-[0.6875rem] text-dim mt-0.5">
                  Lớp {selectedConcept.grade} · {selectedConcept.topic}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-faint hover:text-foreground text-lg">×</button>
            </div>

            {/* Mastery bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-jakarta text-[0.6875rem] text-dim">
                <span>Độ thành thạo</span>
                <span style={{ color: masteryBorder(selectedMastery) }}>{Math.round(selectedMastery * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div className="h-2 rounded-full transition-all" style={{ width: `${selectedMastery * 100}%`, background: masteryBorder(selectedMastery) }} />
              </div>
            </div>

            {/* Exam weight */}
            <div className="flex items-center justify-between font-jakarta text-xs text-muted">
              <span>Trọng số đề thi</span>
              <span className="text-amber-400">{'★'.repeat(Math.round(selectedConcept.exam_weight))} {selectedConcept.exam_weight}</span>
            </div>

            {/* Prerequisites */}
            {selectedConcept.prerequisite_ids.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-jakarta text-[0.6875rem] font-semibold text-muted">Cần học trước</span>
                {selectedConcept.prerequisite_ids.map(pid => {
                  const pc = CONCEPTS.find(c => c.id === pid)
                  const pm = masteryMap[pid] ?? 0
                  return pc ? (
                    <div key={pid} onClick={() => setSelected(pid)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-elevated transition"
                      style={{ border: `1px solid ${masteryBorder(pm)}22` }}>
                      <span className="font-jakarta text-xs text-highlight">{pc.name_vi}</span>
                      <span className="font-jakarta text-[0.625rem]" style={{ color: masteryBorder(pm) }}>{Math.round(pm * 100)}%</span>
                    </div>
                  ) : null
                })}
              </div>
            )}

            {/* Gap trace */}
            {rootWeak && rootWeak !== selected && rootConcept && (
              <div className="px-4 py-3 rounded-xl bg-[#1C1400] border border-amber-400/30">
                <span className="font-jakarta text-[0.6875rem] font-semibold text-amber-400">Gốc điểm yếu</span>
                <p className="font-jakarta text-xs text-muted mt-1">
                  Học <strong className="text-amber-300">{rootConcept.name_vi}</strong> trước để củng cố nền tảng.
                </p>
                <button onClick={() => setSelected(rootWeak)}
                  className="mt-2 font-jakarta text-[0.6875rem] text-amber-400 hover:text-amber-300 transition">
                  Xem khái niệm →
                </button>
              </div>
            )}

            <button
              onClick={() => navigate('/exams?mode=practice')}
              className="mt-auto w-full py-2.5 rounded-xl font-jakarta text-[0.8125rem] font-bold transition"
              style={{ background: '#F2A20C', color: '#0A0E1A' }}>
              Luyện tập ngay
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
