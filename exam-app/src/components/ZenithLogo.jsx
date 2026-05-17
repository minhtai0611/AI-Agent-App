const ARC_PATH = 'M 2 13 A 10 10 0 0 1 22 13'

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
      <svg width={24 * scale} height={14 * scale} viewBox="0 0 24 14" fill="none">
        <path d={ARC_PATH} stroke="#F2A20C" strokeWidth={isHero ? 1.2 : 1.5} strokeLinecap="round" />
      </svg>
      <span className={`font-jakarta font-bold tracking-[0.2em] uppercase text-amber-400 ${isHero ? 'text-xl' : 'text-[13px]'}`}>
        Zenith
      </span>
      {isHero && (
        <span className="font-jakarta text-[9px] tracking-[0.18em] uppercase text-amber-400/50">
          Above the horizon.
        </span>
      )}
    </div>
  )
}
