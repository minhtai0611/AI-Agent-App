// GR-3: animation class names are STATIC strings — dynamic template literals
// would be purged by Tailwind. Each orb object hardcodes its full animate class.
const ORBS = {
  default: [
    {
      color: 'bg-indigo-600',
      size:  'w-[500px] h-[500px]',
      pos:   '-top-40 -left-40',
      anim:  'animate-[ambient-float-0_18s_ease-in-out_0s_infinite]',
      opacity: 'opacity-25',
    },
    {
      color: 'bg-violet-600',
      size:  'w-[400px] h-[400px]',
      pos:   'top-20 -right-20',
      anim:  'animate-[ambient-float-1_22s_ease-in-out_3s_infinite]',
      opacity: 'opacity-20',
    },
    {
      color: 'bg-amber-500',
      size:  'w-[300px] h-[300px]',
      pos:   '-bottom-20 left-1/4',
      anim:  'animate-[ambient-float-2_26s_ease-in-out_6s_infinite]',
      opacity: 'opacity-15',
    },
  ],
  warm: [
    {
      color: 'bg-amber-500',
      size:  'w-[500px] h-[500px]',
      pos:   '-top-20 -right-40',
      anim:  'animate-[ambient-float-0_20s_ease-in-out_0s_infinite]',
      opacity: 'opacity-20',
    },
    {
      color: 'bg-orange-600',
      size:  'w-[350px] h-[350px]',
      pos:   'bottom-0 left-0',
      anim:  'animate-[ambient-float-1_24s_ease-in-out_4s_infinite]',
      opacity: 'opacity-15',
    },
  ],
}

export function AuroraBackground({ children, variant = 'default' }) {
  const orbs = ORBS[variant] ?? ORBS.default
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {orbs.map((orb, i) => (
          <div
            key={i}
            className={`absolute ${orb.color} ${orb.size} ${orb.pos} ${orb.opacity} ${orb.anim} rounded-full mix-blend-screen filter blur-[100px]`}
          />
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
