import { useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * Spring-physics scale pop on milestone achievement.
 * Fires once when `trigger` flips from false → true.
 * If already true on mount (loaded from storage), no animation plays.
 *
 * @example
 * <AchievementCeremony trigger={isComplete}>
 *   <BadgeOrIcon />
 * </AchievementCeremony>
 */
export default function AchievementCeremony({ trigger, children, className }) {
  const wasTriggeredOnMount = useRef(trigger)

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
