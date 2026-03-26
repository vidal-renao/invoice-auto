/**
 * Invoice Auto — Service Worker
 *
 * Strategy:
 *  - Static assets (JS, CSS, fonts, images): Cache-first
 *  - Navigation requests (HTML pages):       Network-first with offline fallback
 *  - Supabase API / Storage calls:           Network-only (never cache auth data)
 */

const CACHE_VERSION = 'v1'
const STATIC_CACHE = `invoice-auto-static-${CACHE_VERSION}`

// Assets to pre-cache on install.
// NOTE: Do NOT include navigation URLs (e.g. '/offline') — they are handled by
// the App Router and return HTML that may redirect. Caching them here would
// cause cache.addAll() to fail if the route is redirected or not yet rendered.
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept Supabase API, auth, or storage calls
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/')
  ) {
    return
  }

  // Static assets — Cache-first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
            }
            return response
          })
      )
    )
    return
  }

  // Navigation — Network-first, no offline fallback (app requires connectivity)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () => new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
      )
    )
  }
})
