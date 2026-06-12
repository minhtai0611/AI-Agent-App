// Phosphor Star (bold) path — source: phosphoricons.com/Star, bold weight, 256×256 grid
const STAR_PATH = 'M234.29,114.85l-45,38.83L203,211a16,16,0,0,1-23.84,17.71L128,198.49,76.84,228.7A16,16,0,0,1,53,211l13.7-57.32-45-38.83A16,16,0,0,1,31.18,86l58.17-5.27,22.39-54.37a16,16,0,0,1,29.52,0l22.39,54.37L221.82,86a16,16,0,0,1,9.11,28.85Z'

export default function ZenithLogo({ variant = 'nav', onClick }) {
  const isHero = variant === 'hero'
  const scale = isHero ? 2.5 : 1
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: isHero ? 4 : 2,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <svg width={24 * scale} height={24 * scale} viewBox="0 0 256 256" fill="none">
        <path d={STAR_PATH} fill="#F2A20C" />
      </svg>
      <span
        className={`font-fraunces font-bold tracking-[0.06em] ${isHero ? 'text-xl zenith-shimmer' : 'text-[0.8125rem] text-amber-400'}`}
        style={isHero ? {
          background: 'linear-gradient(90deg, #F2A20C, #FBBF24, #F59E0B, #F2A20C)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'zenith-shimmer 3s linear infinite',
        } : {}}
      >
        Zenith
      </span>
      {isHero && (
        <span className="font-jakarta text-[9px] tracking-[0.18em] uppercase text-amber-400/50">
          Above the horizon
        </span>
      )}
    </div>
  )
}
