const CACHE = 'exam-static-v1'
const STATIC = [
  '/',
  '/manifest.json',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Only cache GET requests for same-origin navigation/assets
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Pass through API calls
  if (url.pathname.startsWith('/analyze') || url.pathname.startsWith('/hint') ||
      url.pathname.startsWith('/auth') || url.pathname.startsWith('/users')) return

  e.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(res => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      })
      // Serve cached first for navigation, network-first for everything else
      return request.mode === 'navigate' ? (cached || networkFetch) : networkFetch.catch(() => cached)
    })
  )
})
