// Service-worker registration (B-11). The worker itself is public/sw.js (plain JS).
//
// Versioning: the worker URL carries the content hash of the bundle that registers it
// (`sw.js?v=<hash>`). A new deploy changes the hash, so the browser installs a new worker with
// fresh caches, and `onUpdate` lets the UI offer a reload.

export interface ServiceWorkerOptions {
  /** A new version is installed and waiting: call `apply()` to activate it (the page reloads). */
  onUpdate?: (apply: () => void) => void;
  /** First install finished: the app now works offline. */
  onOfflineReady?: () => void;
  /** Worker script URL relative to the page. Default './sw.js'. */
  scriptUrl?: string;
}

/** Environment hooks (replaced in tests). */
export interface ServiceWorkerEnv {
  /** Build identifier appended as `?v=`; undefined = none. */
  version: string | undefined;
  /** Same-origin URLs this page already loaded, to cache for offline use right away. */
  collectUrls: () => string[];
  reload: () => void;
  /** Subscribe to "the app is visible again"; used to look for updates. */
  onVisible: (cb: () => void) => void;
  now: () => number;
}

/** Look for a new version at most this often while the app stays open. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;
const MAX_URLS = 200;

/** Content hash of a Vite bundle URL (`…/assets/index-AbC123xy.js` → `AbC123xy`). */
export function buildVersionFromUrl(url: string): string | undefined {
  const m = /-([A-Za-z0-9_-]{6,})\.m?js(?:[?#].*)?$/.exec(url);
  return m?.[1];
}

/** `./sw.js` + version → `./sw.js?v=<version>`. */
export function workerUrl(scriptUrl: string, version: string | undefined): string {
  if (!version) return scriptUrl;
  return `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}

function collectPageUrls(): string[] {
  const urls = new Set<string>();
  try {
    for (const e of performance.getEntriesByType('resource')) urls.add(e.name);
  } catch {
    // Resource timing unavailable: rely on the DOM below.
  }
  for (const el of document.querySelectorAll<HTMLScriptElement>('script[src]')) urls.add(el.src);
  for (const el of document.querySelectorAll<HTMLLinkElement>('link[href]')) urls.add(el.href);
  const origin = location.origin;
  return [...urls].filter((u) => u.startsWith(`${origin}/`)).slice(0, MAX_URLS);
}

function browserEnv(): ServiceWorkerEnv {
  return {
    version: buildVersionFromUrl(import.meta.url),
    collectUrls: collectPageUrls,
    reload: () => location.reload(),
    onVisible: (cb) =>
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') cb();
      }),
    now: () => Date.now(),
  };
}

/**
 * Register the offline service worker. Does nothing (returns null) in development
 * (`import.meta.env.DEV`) and in browsers without service workers. Never throws.
 */
export async function registerServiceWorker(opts: ServiceWorkerOptions = {}): Promise<ServiceWorkerRegistration | null> {
  if (import.meta.env.DEV) return null;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  return setupServiceWorker(navigator.serviceWorker, opts, browserEnv());
}

/** Registration logic on an explicit container + environment (unit-testable). */
export async function setupServiceWorker(
  container: ServiceWorkerContainer,
  opts: ServiceWorkerOptions,
  env: ServiceWorkerEnv,
): Promise<ServiceWorkerRegistration | null> {
  let reg: ServiceWorkerRegistration;
  try {
    reg = await container.register(workerUrl(opts.scriptUrl ?? './sw.js', env.version), { scope: './' });
  } catch (err) {
    console.warn('[pwa] service worker registration failed', err);
    return null;
  }

  let accepted = false;
  let reloading = false;
  // A worker can be seen both as `reg.installing` and through 'updatefound': report it once.
  const watched = new WeakSet<ServiceWorker>();
  const offered = new WeakSet<ServiceWorker>();
  const offerUpdate = (worker: ServiceWorker) => {
    if (offered.has(worker)) return;
    offered.add(worker);
    opts.onUpdate?.(() => {
      accepted = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  };
  const watch = (worker: ServiceWorker) => {
    if (watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state !== 'installed') return;
      if (container.controller) offerUpdate(worker);
      else opts.onOfflineReady?.();
    });
  };

  // The new worker takes over only after the user accepted: reload once into the new version
  // (the first install also changes controller, through clients.claim(): no reload then).
  container.addEventListener('controllerchange', () => {
    if (!accepted || reloading) return;
    reloading = true;
    env.reload();
  });
  if (reg.waiting && container.controller) offerUpdate(reg.waiting);
  if (reg.installing) watch(reg.installing);
  reg.addEventListener('updatefound', () => {
    if (reg.installing) watch(reg.installing);
  });

  // This page loaded its scripts before the worker existed: hand it the list to cache now.
  void container.ready.then((ready) => {
    ready.active?.postMessage({ type: 'CACHE_URLS', urls: env.collectUrls() });
  });

  let lastCheck = env.now();
  env.onVisible(() => {
    if (env.now() - lastCheck < UPDATE_CHECK_MS) return;
    lastCheck = env.now();
    reg.update().catch(() => undefined);
  });
  return reg;
}
