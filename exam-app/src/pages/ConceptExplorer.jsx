import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import PageShell, { PageCard } from '../components/PageShell.jsx'
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
    <PageShell title="Trực quan 3D" maxWidth="max-w-3xl">
      {question && (
        <div ref={panelRef}>
          <PageCard>
            <MathText className="font-sans text-[0.875rem] text-foreground leading-relaxed">{question.question}</MathText>
          </PageCard>
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
          <div ref={canvasRef} className="glass-elevated rounded-2xl overflow-hidden" style={{ height: 420 }}>
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
    </PageShell>
  )
}
