/* Solfa Reader — offline service worker (owner: solfa-backend, task B-11).
 * Plain JavaScript, copied as-is to dist/. Registered by src/pwa/register.ts as `sw.js?v=<build>`.
 * Works from any sub-path: every URL is resolved against self.registration.scope.
 *
 * Strategies
 *  - navigations / index.html : network first (4 s timeout → cached copy), cache refreshed
 *  - assets/*  (hashed bundles): cache first, cached on first fetch
 *  - tesseract/* (OCR engine)  : cache first, cached on first fetch; carried over between app
 *                                versions with a cheap conditional request (no 7 MB re-download)
 *  - other files in scope      : network, falling back to the cache
 */
'use strict';

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const PREFIX = 'solfa-reader-';
const APP_CACHE = `${PREFIX}app-${VERSION}`;
const OCR_PREFIX = `${PREFIX}ocr-`;
const OCR_CACHE = `${OCR_PREFIX}${VERSION}`;
const SCOPE = self.registration.scope; // always ends with '/'
const SCOPE_PATH = new URL(SCOPE).pathname;
const INDEX_URL = new URL('index.html', SCOPE).href;
const PRECACHE = [SCOPE, INDEX_URL, new URL('manifest.webmanifest', SCOPE).href];
const NAV_TIMEOUT_MS = 4000;
const MAX_MESSAGE_URLS = 200;

/** Path inside the scope ('' for the scope root), or null when outside / another origin. */
function scopedPath(url) {
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return null;
  return url.pathname.slice(SCOPE_PATH.length);
}

function cacheNameFor(path) {
  return path.startsWith('tesseract/') ? OCR_CACHE : APP_CACHE;
}

function cacheable(response) {
  return response && response.status === 200 && response.type === 'basic' && !response.redirected;
}

async function put(cacheName, key, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(key, response);
  } catch (err) {
    // Quota exceeded or private mode: serving still works, only offline support is reduced.
  }
}

/** Keep the OCR files of the previous version if the server says they did not change. */
async function carryOverOcrCache() {
  const names = (await caches.keys()).filter((n) => n.startsWith(OCR_PREFIX) && n !== OCR_CACHE);
  if (names.length === 0) return;
  const target = await caches.open(OCR_CACHE);
  for (const name of names) {
    const old = await caches.open(name);
    for (const request of await old.keys()) {
      if (await target.match(request)) continue;
      const cached = await old.match(request);
      if (!cached) continue;
      const etag = cached.headers.get('ETag');
      const modified = cached.headers.get('Last-Modified');
      const headers = {};
      if (etag) headers['If-None-Match'] = etag;
      if (modified) headers['If-Modified-Since'] = modified;
      let fresh = null;
      if (etag || modified) {
        try {
          const res = await fetch(request.url, { cache: 'no-store', headers });
          if (cacheable(res)) fresh = res; // changed on the server: take the new file
        } catch (err) {
          // Offline: keep the old copy.
        }
      }
      await target.put(request, fresh || cached);
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await Promise.all(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)),
      );
      await carryOverOcrCache().catch(() => undefined);
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([APP_CACHE, OCR_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil(cacheUrls(data.urls.slice(0, MAX_MESSAGE_URLS)));
  }
});

/** Cache files the page loaded before this worker controlled it. */
async function cacheUrls(urls) {
  for (const raw of urls) {
    if (typeof raw !== 'string') continue;
    let url;
    try {
      url = new URL(raw, SCOPE);
    } catch (err) {
      continue;
    }
    const path = scopedPath(url);
    if (path === null || path === '' || path === 'index.html' || path === 'sw.js') continue;
    url.hash = '';
    const cache = await caches.open(cacheNameFor(path));
    if (await cache.match(url.href)) continue;
    try {
      const res = await fetch(url.href);
      if (cacheable(res)) await cache.put(url.href, res);
    } catch (err) {
      // Offline or gone: skip.
    }
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function cachedPage(request) {
  const cache = await caches.open(APP_CACHE);
  return (
    (await cache.match(request, { ignoreSearch: true })) ||
    (await cache.match(INDEX_URL)) ||
    (await cache.match(SCOPE))
  );
}

/** Network first for the HTML page; slow networks fall back to the cached copy after 4 s. */
function networkFirstPage(event) {
  const request = event.request;
  const network = fetch(request).then(async (res) => {
    if (cacheable(res)) {
      const url = new URL(request.url);
      url.search = '';
      url.hash = '';
      await put(APP_CACHE, url.href, res.clone());
    }
    return res;
  });
  event.waitUntil(network.then(() => undefined, () => undefined));
  return (async () => {
    const cached = await cachedPage(request);
    if (!cached) return network;
    try {
      return await withTimeout(network, NAV_TIMEOUT_MS);
    } catch (err) {
      return cached;
    }
  })();
}

async function cacheFirst(event, cacheName) {
  const request = event.request;
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res)) event.waitUntil(put(cacheName, request, res.clone()));
  return res;
}

async function networkThenCache(event) {
  const request = event.request;
  try {
    const res = await fetch(request);
    if (cacheable(res)) event.waitUntil(put(APP_CACHE, request, res.clone()));
    return res;
  } catch (err) {
    const cache = await caches.open(APP_CACHE);
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const path = scopedPath(new URL(request.url));
  if (path === null || path === 'sw.js') return;
  if (request.mode === 'navigate' || path === '' || path === 'index.html') {
    event.respondWith(networkFirstPage(event));
  } else if (path.startsWith('assets/') || path.startsWith('tesseract/')) {
    event.respondWith(cacheFirst(event, cacheNameFor(path)));
  } else {
    event.respondWith(networkThenCache(event));
  }
});
