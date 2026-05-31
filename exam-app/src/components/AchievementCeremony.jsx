import { useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * Tier 3 ceremony — spring-physics scale pop on milestone achievement.
 *
 * Fires once when `trigger` flips from false → true.
 * If already true on mount (loaded from storage), no animation plays.
 *
 * Usage:
 *   <AchievementCeremony trigger={isComplete}>
 *     <BadgeOrIcon />
 *   </AchievementCeremony>
 */
export default function AchievementCeremony({ trigger, children, className }) {
  const wasTriggeredOnMount = useRef(trigger)

  // No animation if already triggered at mount time (stale state from storage)
  const initial = wasTriggeredOnMount.current ? false : { scale: 0.7, opacity: 0 }
  const animate = trigger
    ? { scale: 1, opacity: 1 }
    : { scale: 0.7, opacity: 0 }

  return (
    <motion.span
      className={className}
      initial={initial}
      animate={animate}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
    >
      {children}
    </motion.span>
  )
}
