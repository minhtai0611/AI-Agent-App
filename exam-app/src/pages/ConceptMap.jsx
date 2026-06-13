import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'
import { useAuth } from '../context/AuthContext.jsx'
import { getConceptMastery, getConceptMasteryHistory, getReviewItemCounts } from '../api/aiClient.js'
import { CONCEPTS, TOPIC_COLORS } from '../data/concepts.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

// ── Mastery colour ────────────────────────────────────────────────────────────
function masteryColor(score) {
  if (score === 0 || score === undefined) return 'var(--border)'   // grey — never tried
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
  g.setGraph({ rankdir: 'LR', ranksep: 90, nodesep: 36 })
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
  const isMastered = (data.mastery_score ?? 0) >= 0.85
  const isLocked = data.isLocked
  return (
    <div
      style={{
        background: isLocked ? '#1A1F2E' : masteryColor(data.mastery_score),
        border: `1.5px solid ${isLocked ? '#2D3748' : masteryBorder(data.mastery_score)}`,
        borderRadius: 10,
        padding: '6px 10px',
        width: NODE_W,
        minHeight: NODE_H,
        cursor: 'pointer',
        opacity: isLocked ? 0.6 : 1,
        boxShadow: data.selected
          ? `0 0 0 2px #6366F1`
          : isMastered
          ? `0 0 8px 1px #10B98133`
          : undefined,
        animation: isMastered ? 'masteryPulse 2.5s ease-in-out infinite' : undefined,
        position: 'relative',
      }}
    >
      {/* Topic color stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        borderRadius: '8px 8px 0 0',
        background: isLocked ? '#2D3748' : (TOPIC_COLORS[data.topic] || '#64748B'),
        opacity: isLocked ? 0.3 : 0.75,
      }} />
      {isLocked && (
        <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 10, opacity: 0.7 }}>🔒</span>
      )}
      <div style={{ fontSize: Math.max(10, Math.min(13, size)), fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: isLocked ? '#64748B' : '#F0F4FF', lineHeight: 1.3, marginTop: 4 }}>
        {data.name_vi}
      </div>
      <div style={{ fontSize: 9, color: '#475569', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 2 }}>
        Lớp {data.grade} · {isLocked ? 'Chưa mở khoá' : `${Math.round((data.mastery_score || 0) * 100)}%`}
      </div>
    </div>
  )
}

const nodeTypes = { concept: ConceptNode }

// ── Mastery sparkline (SVG, no library) ──────────────────────────────────────
function MasterySparkline({ history }) {
  if (!history || history.length < 2) return null
  const W = 220, H = 48, PAD = 4
  const scores = history.map(h => h.mastery_score)
  const min = Math.min(...scores, 0)
  const max = Math.max(...scores, 20)
  const range = max - min || 1
  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((s - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  })
  const last = history[history.length - 1]
  const lastColor = masteryBorder(last.mastery_score / 100)
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={lastColor}
        strokeWidth="1.5"
        strokeOpacity="0.7"
      />
      {pts.map((pt, i) => {
        const [x, y] = pt.split(',').map(Number)
        return (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3.5 : 2}
            fill={masteryBorder(scores[i] / 100)}
            opacity={i === pts.length - 1 ? 1 : 0.5} />
        )
      })}
    </svg>
  )
}

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
  const [reviewCounts, setReviewCounts] = useState({})
  const [conceptHistory, setConceptHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Fetch mastery + review counts ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    Promise.all([
      getConceptMastery(),
      getReviewItemCounts(),
    ]).then(([masteryRes, countsRes]) => {
      if (masteryRes.data?.concepts) {
        const map = {}
        masteryRes.data.concepts.forEach(c => { map[c.id] = c.mastery_score ?? 0 })
        setMasteryMap(map)
      }
      if (countsRes.data?.counts) {
        setReviewCounts(countsRes.data.counts)
      }
      setLoading(false)
    })
  }, [user?.id])

  // ── Fetch concept history when selection changes ───────────────────────────
  useEffect(() => {
    if (!selected || !user?.id) { setConceptHistory(null); return }
    setHistoryLoading(true)
    getConceptMasteryHistory(selected).then(({ data }) => {
      setConceptHistory(data?.history ?? [])
      setHistoryLoading(false)
    }).catch(() => {
      setConceptHistory([])
      setHistoryLoading(false)
    })
  }, [selected, user?.id])

  // ── Build graph ────────────────────────────────────────────────────────────
  useEffect(() => {
    const filtered = gradeFilter === 0
      ? CONCEPTS
      : CONCEPTS.filter(c => c.grade === gradeFilter)

    const filteredIds = new Set(filtered.map(c => c.id))

    const UNLOCK_THRESHOLD = 0.7
    const rawNodes = filtered.map(c => ({
      id: c.id,
      type: 'concept',
      data: {
        ...c,
        mastery_score: masteryMap[c.id] ?? 0,
        selected: selected === c.id,
        isLocked: c.prerequisite_ids.length > 0 && c.prerequisite_ids.some(
          pid => (masteryMap[pid] ?? 0) < UNLOCK_THRESHOLD
        ),
      },
      position: { x: 0, y: 0 },
    }))

    const rawEdges = []
    filtered.forEach(c => {
      c.prerequisite_ids.forEach(prereqId => {
        if (filteredIds.has(prereqId)) {
          const srcTopic = filtered.find(x => x.id === prereqId)?.topic
          const edgeColor = TOPIC_COLORS[srcTopic] || '#64748B'
          rawEdges.push({
            id: `${prereqId}->${c.id}`,
            source: prereqId,
            target: c.id,
            animated: false,
            style: { stroke: edgeColor, strokeWidth: 1.5, opacity: 0.55 },
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
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

  // ── Highlight edges for gap trace / locked prerequisites ──────────────────
  const selectedIsLocked = useMemo(() => {
    if (!selected) return false
    const c = CONCEPTS.find(x => x.id === selected)
    if (!c || c.prerequisite_ids.length === 0) return false
    return c.prerequisite_ids.some(pid => (masteryMap[pid] ?? 0) < 0.7)
  }, [selected, masteryMap])

  useEffect(() => {
    if (!selected) return
    setEdges(eds => eds.map(e => {
      const inChain = gapChain.has(e.source) && gapChain.has(e.target)
      // For locked concepts: highlight blocking prerequisite edges in red
      const isBlockingEdge = selectedIsLocked && e.target === selected
        && (masteryMap[e.source] ?? 0) < 0.7
      const srcTopic = CONCEPTS.find(x => x.id === e.source)?.topic
      const topicColor = TOPIC_COLORS[srcTopic] || '#64748B'
      return {
        ...e,
        style: isBlockingEdge
          ? { stroke: '#EF4444', strokeWidth: 2.5, opacity: 1 }
          : inChain
          ? { stroke: '#F59E0B', strokeWidth: 2.5, opacity: 1 }
          : { stroke: topicColor, strokeWidth: 1.5, opacity: 0.55 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isBlockingEdge ? '#EF4444' : inChain ? '#F59E0B' : topicColor,
        },
      }
    }))
  }, [gapChain, selected, selectedIsLocked, masteryMap])

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
    <div className="min-h-screen bg-surface flex flex-col">
      <style>{`
        @keyframes masteryPulse {
          0%, 100% { box-shadow: 0 0 8px 1px #10B98133; }
          50%       { box-shadow: 0 0 16px 4px #10B98166; }
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/exams?mode=lab')}
            className="font-sans text-[13px] text-dim hover:text-muted transition">
            ← Lab
          </button>
          <span className="font-sans text-[18px] font-bold text-foreground">Bản đồ khái niệm</span>
        </div>
        <div className="flex items-center gap-2">
          {[0, 9, 10, 11, 12].map(g => (
            <button key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-3 py-1.5 rounded-full font-sans text-[11px] transition ${
                gradeFilter === g
                  ? 'bg-primary text-background font-bold'
                  : 'border border-surface text-dim hover:text-muted'
              }`}>
              {g === 0 ? 'Tất cả' : `Lớp ${g}`}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 px-6 py-2 glass-base border-b border-surface">
        <span className="font-sans text-[11px] text-dim">{stats.total} khái niệm</span>
        <span className="font-sans text-[11px] text-info">{stats.tried} đã học</span>
        <span className="font-sans text-[11px] text-success">{stats.strong} thành thạo ≥70%</span>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {[['var(--mastery-5-bg)','var(--mastery-5)','≥70%'],['var(--mastery-3-bg)','var(--mastery-3)','40-69%'],['var(--mastery-1-bg)','var(--mastery-1)','<40%'],['var(--surface)','var(--border)','Chưa học']].map(([bg,border,label]) => (
            <span key={label} className="flex items-center gap-1 font-sans text-[10px] text-dim">
              <span style={{ width: 10, height: 10, background: bg, border: `1.5px solid ${border}`, borderRadius: 2, display: 'inline-block' }} />
              {label}
            </span>
          ))}
          <span className="w-px h-3 bg-border mx-1" />
          {Object.entries(TOPIC_COLORS).map(([topic, color]) => (
            <span key={topic} className="flex items-center gap-1 font-sans text-[10px] text-dim">
              <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: 'inline-block', opacity: 0.75 }} />
              {topic}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Flow canvas */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="font-sans text-[13px] text-dim">Đang tải bản đồ...</span>
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
              style={{ background: 'var(--surface)' }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--border)" gap={24} />
              <Controls style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
              <MiniMap
                nodeColor={n => masteryColor(n.data?.mastery_score)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              />
            </ReactFlow>
          )}
        </div>

        {/* Detail panel */}
        {selectedConcept && (
          <div className="w-72 border-l border-surface glass-base flex flex-col gap-4 p-5 overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-sans text-[16px] font-bold text-foreground">
                  {selectedIsLocked && <span className="mr-1 text-[14px]">🔒</span>}
                  {selectedConcept.name_vi}
                </span>
                <div className="font-sans text-[11px] text-dim mt-0.5">
                  Lớp {selectedConcept.grade} · {selectedConcept.topic}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-dim hover:text-foreground text-lg">×</button>
            </div>

            {/* Locked state — show blocking prerequisites instead of normal detail */}
            {selectedIsLocked && (
              <div className="flex flex-col gap-3">
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <span className="font-sans text-[11px] font-semibold text-red-400">Khái niệm bị khoá</span>
                  <p className="font-sans text-[12px] text-muted mt-1">
                    Học xong các khái niệm sau để mở khoá:
                  </p>
                </div>
                {selectedConcept.prerequisite_ids
                  .filter(pid => (masteryMap[pid] ?? 0) < 0.7)
                  .map(pid => {
                    const pc = CONCEPTS.find(c => c.id === pid)
                    const pm = masteryMap[pid] ?? 0
                    return pc ? (
                      <div key={pid} className="flex items-center justify-between px-3 py-2 rounded-lg border border-red-500/20 bg-surface">
                        <div>
                          <span className="font-sans text-[12px] text-foreground">{pc.name_vi}</span>
                          <div className="font-sans text-[10px] text-dim">{Math.round(pm * 100)}% / cần 70%</div>
                        </div>
                        <button
                          onClick={() => navigate(`/practice/adaptive?topic=${pc.topic}`)}
                          className="font-sans text-[10px] text-primary hover:underline"
                        >
                          Luyện tập →
                        </button>
                      </div>
                    ) : null
                  })
                }
              </div>
            )}

            {/* Normal detail — only show when not locked */}
            {!selectedIsLocked && <div className="flex flex-col gap-1">
              <div className="flex justify-between font-sans text-[11px] text-dim">
                <span>Độ thành thạo</span>
                <span style={{ color: masteryBorder(selectedMastery) }}>{Math.round(selectedMastery * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface overflow-hidden">
                <div className="h-2 rounded-full transition-all" style={{ width: `${selectedMastery * 100}%`, background: masteryBorder(selectedMastery) }} />
              </div>

            {/* Exam weight + review count */}
            <div className="flex items-center justify-between font-sans text-[12px] text-muted">
              <span>Trọng số đề thi</span>
              <span className="text-[var(--accent)]">{'★'.repeat(Math.round(selectedConcept.exam_weight))} {selectedConcept.exam_weight}</span>
            </div>
            {reviewCounts[selected] != null && (
              <div className="flex items-center gap-2">
                <span className="font-sans text-[11px] text-dim">Câu ôn tập</span>
                <span className="font-sans text-[11px] px-2 py-0.5 rounded-full bg-surface border border-surface"
                  style={{ color: reviewCounts[selected].due > 0 ? '#F59E0B' : '#475569' }}>
                  {reviewCounts[selected].due > 0
                    ? `${reviewCounts[selected].due} đến hạn`
                    : `${reviewCounts[selected].total} câu`}
                </span>
              </div>
            )}

            {/* Mastery history timeline */}
            {historyLoading ? (
              <div className="font-sans text-[11px] text-dim text-center py-2">Đang tải lịch sử...</div>
            ) : conceptHistory && conceptHistory.length >= 2 ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-sans text-[11px] text-muted">
                  <span>Lịch sử tiến độ</span>
                  <span className="text-dim">{conceptHistory.length} lần ôn</span>
                </div>
                <div className="overflow-hidden rounded-lg" style={{ background: 'var(--surface)', padding: '6px 4px' }}>
                  <MasterySparkline history={conceptHistory} />
                </div>
                <div className="flex justify-between font-sans text-[10px] text-dim">
                  <span>{conceptHistory[0].recorded_at?.slice(0, 10)}</span>
                  <span>{conceptHistory[conceptHistory.length - 1].recorded_at?.slice(0, 10)}</span>
                </div>
              </div>
            ) : conceptHistory && conceptHistory.length === 1 ? (
              <div className="font-sans text-[11px] text-dim text-center py-1">
                Bắt đầu ôn tập để xem biểu đồ tiến độ
              </div>
            ) : null}

            {/* Prerequisites */}
            {selectedConcept.prerequisite_ids.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-sans text-[11px] font-semibold text-muted">Cần học trước</span>
                {selectedConcept.prerequisite_ids.map(pid => {
                  const pc = CONCEPTS.find(c => c.id === pid)
                  const pm = masteryMap[pid] ?? 0
                  return pc ? (
                    <div key={pid} onClick={() => setSelected(pid)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-surface transition"
                      style={{ border: `1px solid ${masteryBorder(pm)}22` }}>
                      <span className="font-sans text-[12px] text-foreground">{pc.name_vi}</span>
                      <span className="font-sans text-[10px]" style={{ color: masteryBorder(pm) }}>{Math.round(pm * 100)}%</span>
                    </div>
                  ) : null
                })}
              </div>
            )}

            {/* Gap trace */}
            {rootWeak && rootWeak !== selected && rootConcept && (
              <div className="px-4 py-3 rounded-xl glass-base border border-[var(--accent-border)]/30">
                <span className="font-sans text-[11px] font-semibold text-[var(--accent)]">Gốc điểm yếu</span>
                <p className="font-sans text-[12px] text-muted mt-1">
                  Học <strong className="text-[var(--accent)]">{rootConcept.name_vi}</strong> trước để củng cố nền tảng.
                </p>
                <button onClick={() => setSelected(rootWeak)}
                  className="mt-2 font-sans text-[11px] text-[var(--accent)] hover:text-[var(--accent)] transition">
                  Xem khái niệm →
                </button>
              </div>
            )}
            </div>}

            {!selectedIsLocked && <button
              onClick={() => navigate(`/practice/adaptive?topic=${selectedConcept.topic}`)}
              className="mt-auto w-full py-2.5 rounded-xl font-sans text-[13px] font-bold transition bg-primary text-background">
              Luyện tập ngay
            </button>}
            <button
              onClick={() => navigate('/review')}
              className="w-full py-2 rounded-xl font-sans text-[12px] font-semibold transition border border-info/30 text-info hover:bg-info/10">
              Ôn tập câu hôm nay
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
