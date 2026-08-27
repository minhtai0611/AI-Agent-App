import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { Scene3DLazy } from '../components/motion/Scene3DLazy.jsx'
import Static2DFallback from '../components/motion/scenes/concept/Static2DFallback.jsx'
import { resolveConceptScene } from '../components/motion/scenes/concept/registry.js'
import { useGsapTimeline } from '../hooks/useGsapTimeline.js'
import { loadConceptSpec, loadQuestionsByIds } from '../api/index.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { MathText } from '../components/MathText.jsx'

export default function ConceptExplorer() {
  usePageMeta('Trực quan 3D', { noindex: true })
  const { questionId } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'unavailable'
  const [result, setResult] = useState(null) // {available, spec, annotation, reason}
  const [question, setQuestion] = useState(null)

  const panelRef = useRef(null)
  const canvasRef = useRef(null)
  const controlsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    Promise.all([loadConceptSpec(questionId), loadQuestionsByIds([questionId])]).then(([spec, questions]) => {
      if (cancelled) return
      setQuestion(questions[0] ?? null)
      setResult(spec)
      setStatus(spec?.available ? 'ready' : 'unavailable')
    })
    return () => { cancelled = true }
  }, [questionId])

  useGsapTimeline(
    (tl) => {
      if (status !== 'ready') return
      tl.from(panelRef.current, { opacity: 0, y: -12, duration: 0.4, ease: 'power2.out' })
        .from(canvasRef.current, { opacity: 0, scale: 0.96, duration: 0.5, ease: 'power2.out' }, '-=0.15')
        .from(controlsRef.current, { opacity: 0, y: 12, duration: 0.35, ease: 'power2.out' }, '-=0.1')
    },
    { dependencies: [status] }
  )

  const scene = result?.spec ? resolveConceptScene(result.spec.template) : null

  return (
    <motion.div
      className="min-h-screen bg-background flex flex-col relative"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <header className="flex items-center justify-between px-10 py-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="font-sans text-sm text-dim hover:text-muted transition">
          ← Quay lại
        </button>
        <h1 className="font-sans text-[20px] font-bold text-foreground">Trực quan 3D</h1>
        <div className="w-16" />
      </header>

      <div className="flex-1 flex flex-col gap-4 p-6 sm:p-10 max-w-3xl mx-auto w-full">
        {question && (
          <div ref={panelRef} className="bg-surface border border-border rounded-2xl p-5">
            <MathText className="font-sans text-[0.875rem] text-foreground leading-relaxed">{question.question}</MathText>
          </div>
        )}

        {status === 'loading' && (
          <div data-testid="concept-loading" className="flex-1 flex items-center justify-center min-h-[320px]">
            <span className="font-sans text-sm text-dim">Đang tạo mô hình 3D…</span>
          </div>
        )}

        {status === 'unavailable' && (
          <div data-testid="concept-empty" className="flex-1 flex items-center justify-center min-h-[320px]">
            <span className="font-sans text-sm text-faint">Câu hỏi này chưa có mô hình trực quan phù hợp.</span>
          </div>
        )}

        {status === 'ready' && scene && (
          <>
            <div ref={canvasRef} className="bg-surface border border-border rounded-2xl overflow-hidden" style={{ height: 420 }}>
              <Scene3DLazy
                scene={scene}
                sceneProps={{ spec: result.spec }}
                fallback={<Static2DFallback spec={result.spec} />}
              />
            </div>
            {result.annotation && (
              <p ref={controlsRef} className="font-sans text-[0.8125rem] text-muted">{result.annotation}</p>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
