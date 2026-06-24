import { useEffect } from 'react'

const DEFAULT_TITLE = 'Luminary · Ánh sáng dẫn đường — Ôn thi Toán THPT & Lớp 10'
const SUFFIX = ' — Luminary'

/**
 * Sets document.title, meta description, and noindex per page.
 * Cleans up on unmount so navigating away doesn't leave stale meta.
 *
 * @param {string} title - Page-specific title (without suffix). Pass '' for the home page default.
 * @param {{ description?: string, noindex?: boolean }} [opts]
 */
export function usePageMeta(title, { description, noindex } = {}) {
  useEffect(() => {
    document.title = title ? `${title}${SUFFIX}` : DEFAULT_TITLE

    let descTag = document.querySelector('meta[name="description"]')
    if (description) {
      if (!descTag) {
        descTag = document.createElement('meta')
        descTag.name = 'description'
        document.head.appendChild(descTag)
      }
      descTag.content = description
    }

    let robotsTag = document.querySelector('meta[name="robots"]')
    if (noindex) {
      if (!robotsTag) {
        robotsTag = document.createElement('meta')
        robotsTag.name = 'robots'
        document.head.appendChild(robotsTag)
      }
      robotsTag.content = 'noindex, nofollow'
    }

    return () => {
      // Remove noindex on unmount — don't let it bleed to the next route
      const staleRobots = document.querySelector('meta[name="robots"]')
      if (staleRobots) staleRobots.remove()
    }
  }, [title, description, noindex])
}
