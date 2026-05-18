const CACHE_SHELL = 'exam-shell-v4'
const CACHE_ASSETS = 'exam-assets-v4'

// App shell — cached on install for reliable offline navigation
const SHELL_URLS = ['/', '/manifest.json', '/favicon.svg', '/offline.html']

// Asset types that are safe to cache aggressively (hashed filenames never change)
function isHashedAsset(url) {
  return /\/assets\/[^/]+-[A-Za-z0-9]{8}\.(js|css|woff2?)$/.test(url.pathname)
}

function isStaticJson(url) {
  return url.pathname.endsWith('.json') && url.origin === self.location.origin
}

// API calls — never cache
function isApiCall(url) {
  const p = url.pathname
  return p.startsWith('/analyze') || p.startsWith('/hint') || p.startsWith('/explain') ||
    p.startsWith('/auth') || p.startsWith('/users') || p.startsWith('/study-plan') ||
    p.startsWith('/math') || p.startsWith('/tutor') || p.startsWith('/wiki') ||
    p.startsWith('/admin') || p.startsWith('/questions')
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_SHELL).then(c => c.addAll(SHELL_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_SHELL && k !== CACHE_ASSETS)
          .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (isApiCall(url)) return  // let API calls pass through without caching

  // Hashed JS/CSS assets — cache-first (they never change)
  if (isHashedAsset(url)) {
    e.respondWith(
      caches.open(CACHE_ASSETS).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
        })
      )
    )
    return
  }

  // Static JSON data files (questions.json, exams.json, schools.json) — network-first, cache fallback
  if (isStaticJson(url)) {
    e.respondWith(
      caches.open(CACHE_ASSETS).then(cache =>
        fetch(request)
          .then(res => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
          .catch(() => cache.match(request))
      )
    )
    return
  }

  // Navigation (HTML pages) — network-first, fallback to offline page
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline.html').then(r => r || caches.match('/').then(s => s || new Response('Offline', { status: 503 })))
      )
    )
    return
  }

  // Everything else — network-first with cache fallback
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok && url.origin === self.location.origin) {
          caches.open(CACHE_ASSETS).then(c => c.put(request, res.clone()))
        }
        return res
      })
      .catch(() => caches.match(request))
  )
})
