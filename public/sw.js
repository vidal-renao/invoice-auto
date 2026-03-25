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
const OFFLINE_URL = '/offline'

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/offline',
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

  // Navigation — Network-first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (cached) => cached ?? new Response('Offline', { status: 503 })
        )
      )
    )
  }
})
