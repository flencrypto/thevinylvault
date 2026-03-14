const CACHE_VERSION = 'vinylvault-v1'

const PRECACHE_URLS = [
  '/',
  '/index.html',
]

const API_HOSTS = [
  'api.ebay.com',
  'api.discogs.com',
  'api.openai.com',
  'api.x.ai',
  'api.deepseek.com',
  'api.telegram.org',
  'api.imgbb.com',
  'musicbrainz.org',
  'api.multiversx.com',
]

const CDN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Network-only for API requests
  if (API_HOSTS.some((host) => url.hostname.includes(host))) {
    return
  }

  // Stale-while-revalidate for CDN resources
  if (CDN_HOSTS.some((host) => url.hostname.includes(host))) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone())
            }
            return networkResponse
          })
          return cachedResponse || fetchPromise
        })
      })
    )
    return
  }

  // Cache-first for same-origin assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok && event.request.method === 'GET') {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return networkResponse
        })
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html')
        }
        return new Response('Offline - VinylVault', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        })
      })
    )
    return
  }
})
