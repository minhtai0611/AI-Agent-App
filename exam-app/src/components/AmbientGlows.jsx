const ORBS = [
  { color: '#3b82f6', size: 320, left: '10%',  top: '20%', duration: 18, delay: 0   },
  { color: '#8b5cf6', size: 240, left: '75%',  top: '60%', duration: 23, delay: -7  },
  { color: '#06b6d4', size: 180, left: '50%',  top: '80%', duration: 15, delay: -4  },
  { color: '#f59e0b', size: 140, left: '85%',  top: '15%', duration: 20, delay: -10 },
]

export default function AmbientGlows({ className = '' }) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      {ORBS.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width:  orb.size,
            height: orb.size,
            left:   orb.left,
            top:    orb.top,
            transform: 'translate(-50%, -50%)',
            background: orb.color,
            filter:     'blur(80px)',
            mixBlendMode: 'screen',
            opacity: 0.12,
            animation: `ambient-float-${i} ${orb.duration}s ease-in-out ${orb.delay}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes ambient-float-0 { from { transform: translate(-50%,-50%) translate(0,0); } to { transform: translate(-50%,-50%) translate(20px,30px); } }
        @keyframes ambient-float-1 { from { transform: translate(-50%,-50%) translate(0,0); } to { transform: translate(-50%,-50%) translate(-25px,20px); } }
        @keyframes ambient-float-2 { from { transform: translate(-50%,-50%) translate(0,0); } to { transform: translate(-50%,-50%) translate(15px,-25px); } }
        @keyframes ambient-float-3 { from { transform: translate(-50%,-50%) translate(0,0); } to { transform: translate(-50%,-50%) translate(-20px,15px); } }
        @media (prefers-reduced-motion: reduce) {
          [style*="ambient-float"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
